import { NextRequest, NextResponse } from 'next/server';
import { callOdoo } from '@/lib/odoo-auth';
import {
  EMAIL_PROJECT_IDS,
  TAG_OCR_DONE,
  TAG_OCR_FAILED,
  isJunkAttachment,
  hasCompanionMarkdown,
  jetsonJobStart,
  jetsonJobStatus,
  buildCleanedName,
  imageFallbackName,
  extensionOf,
  buildChatterHtml,
  type OCRHeader,
} from '@/lib/ocr/attachments-pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const LOOKBACK_DAYS = parseInt(process.env.OCR_CRON_LOOKBACK_DAYS || '30', 10);
const MAX_TASKS_PER_RUN = parseInt(process.env.OCR_CRON_MAX_TASKS || '50', 10);
// Modelli extra (oltre alle email) processati cercando direttamente gli allegati.
const EXTRA_MODELS = (process.env.OCR_CRON_MODELS || 'purchase.order,stock.picking')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const MAX_RECORDS_PER_MODEL = parseInt(process.env.OCR_CRON_MAX_RECORDS || '20', 10);
const SOFT_DEADLINE_MS = 240_000;

const JOB_PREFIX = 'OCR_JOB:';

async function ensureTag(name: string): Promise<number> {
  const existing = await callOdoo(null, 'project.tags', 'search_read', [
    [['name', '=', name]],
    ['id', 'name'],
  ]);
  if (existing.length > 0) return existing[0].id;
  return await callOdoo(null, 'project.tags', 'create', [{ name }]);
}

function sinceIso(): string {
  return new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
}

async function searchCandidateTasks(doneTagId: number, failedTagId: number): Promise<number[]> {
  return (await callOdoo(
    null,
    'project.task',
    'search',
    [[
      ['project_id', 'in', EMAIL_PROJECT_IDS],
      ['create_date', '>=', sinceIso()],
      ['tag_ids', 'not in', [doneTagId, failedTagId]],
    ]],
    { limit: MAX_TASKS_PER_RUN, order: 'create_date desc' },
  )) as number[];
}

// Modelli senza tagging (purchase.order, stock.picking, ...): cerco direttamente gli
// allegati PDF/immagine recenti e li raggruppo per record padre.
async function searchCandidateRecords(resModel: string): Promise<Map<number, any[]>> {
  const grouped = new Map<number, any[]>();
  const cand: any[] = await callOdoo(
    null,
    'ir.attachment',
    'search_read',
    [
      [
        ['res_model', '=', resModel],
        ['create_date', '>=', sinceIso()],
        '|',
        ['mimetype', '=', 'application/pdf'],
        ['mimetype', '=like', 'image/%'],
      ],
      ['res_id'],
    ],
    { order: 'create_date desc', limit: MAX_RECORDS_PER_MODEL },
  );
  const resIds = Array.from(new Set(cand.map((c: any) => c.res_id).filter(Boolean)));
  if (resIds.length === 0) return grouped;
  // Tutti gli allegati di quei record (serve il check companion .md + stato job).
  const all: any[] = await callOdoo(null, 'ir.attachment', 'search_read', [
    [
      ['res_model', '=', resModel],
      ['res_id', 'in', resIds],
    ],
    ['id', 'name', 'mimetype', 'file_size', 'description', 'res_id'],
  ]);
  for (const a of all) {
    if (!grouped.has(a.res_id)) grouped.set(a.res_id, []);
    grouped.get(a.res_id)!.push(a);
  }
  return grouped;
}

interface AttachState {
  id: number;
  name: string;
  mimetype: string;
  fileSize: number;
  description: string;
  outcome: 'pending' | 'done' | 'failed' | 'skipped';
  detail: string;
}

// Core riusabile: processa gli allegati di UN record qualsiasi (model-agnostico).
// Non fa tagging. Crea l'MD compagno e posta nel chatter del record.
async function processAttachmentList(
  resModel: string,
  resId: number,
  allAttachments: any[],
): Promise<AttachState[]> {
  const states: AttachState[] = [];
  const allNames = allAttachments.map((a: any) => a.name);
  const attachments = allAttachments.filter((a: any) =>
    a.mimetype === 'application/pdf' || (a.mimetype || '').startsWith('image/'),
  );

  for (const att of attachments) {
    const description = att.description || '';
    const desc = typeof description === 'string' ? description : '';
    const filter = isJunkAttachment(att.name, att.file_size, att.mimetype);
    const baseState: Omit<AttachState, 'outcome' | 'detail'> = {
      id: att.id,
      name: att.name,
      mimetype: att.mimetype,
      fileSize: att.file_size,
      description: desc,
    };

    if (filter.skip && !desc.startsWith(JOB_PREFIX)) {
      states.push({ ...baseState, outcome: 'skipped', detail: `SKIP ${att.name}: ${filter.reason}` });
      continue;
    }

    // Se esiste già un MD compagno, considero gia processato e skippo
    if (hasCompanionMarkdown(att.name, allNames) && !desc.startsWith(JOB_PREFIX)) {
      states.push({ ...baseState, outcome: 'skipped', detail: `SKIP ${att.name}: MD compagno già presente` });
      continue;
    }

    // Caso 1: gia' c'e' un job attivo per questo allegato
    if (desc.startsWith(JOB_PREFIX)) {
      const jobId = desc.slice(JOB_PREFIX.length).split(':')[0];
      try {
        const status = await jetsonJobStatus(jobId);
        if (status.status === 'queued' || status.status === 'running') {
          states.push({ ...baseState, outcome: 'pending', detail: `WAIT ${att.name} job=${jobId} status=${status.status}` });
          continue;
        }
        if (status.status === 'failed') {
          await callOdoo(null, 'ir.attachment', 'write', [[att.id], { description: '' }]);
          await callOdoo(null, resModel, 'message_post', [[resId]], {
            body: buildChatterHtml({ status: 'failed', attachmentName: att.name, errorMessage: status.error || 'unknown' }),
            message_type: 'comment',
            subtype_xmlid: 'mail.mt_note',
          });
          states.push({ ...baseState, outcome: 'failed', detail: `FAIL ${att.name} job=${jobId}: ${status.error}` });
          continue;
        }
        // status = done
        const result = status.result!;
        const header = result.header as OCRHeader | undefined;
        const ext = extensionOf(att.name) || (att.mimetype === 'application/pdf' ? '.pdf' : '.jpg');
        let newName: string;
        if (header && (header.doc_type || header.vendor)) {
          newName = buildCleanedName(att.name, header, ext);
        } else if (att.mimetype.startsWith('image/')) {
          newName = imageFallbackName(att.name);
        } else {
          newName = att.name;
        }
        const writeData: any = { description: '' };
        if (newName !== att.name) writeData.name = newName;
        await callOdoo(null, 'ir.attachment', 'write', [[att.id], writeData]);

        const cleanedMd = result.cleaned_markdown || result.markdown || '';
        const mdName = newName.replace(/\.[A-Za-z0-9]+$/, '') + '.md';
        const mdBase64 = Buffer.from(cleanedMd, 'utf-8').toString('base64');
        const mdAttachmentId = await callOdoo(null, 'ir.attachment', 'create', [{
          name: mdName,
          res_model: resModel,
          res_id: resId,
          type: 'binary',
          datas: mdBase64,
          mimetype: 'text/markdown',
        }]);
        await callOdoo(null, resModel, 'message_post', [[resId]], {
          body: buildChatterHtml({
            status: 'ok',
            attachmentName: att.name,
            newName,
            header,
            wallTimeSec: Math.round(status.wall_time_s || 0),
            numPages: result.num_pages,
            mdAttachmentId,
            mdPreview: cleanedMd.slice(0, 600),
          }),
          message_type: 'comment',
          subtype_xmlid: 'mail.mt_note',
        });
        states.push({ ...baseState, outcome: 'done', detail: `OK ${att.name} -> ${newName} (${result.num_pages}p, ${Math.round(status.wall_time_s || 0)}s)` });
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        const isExpired = /HTTP 404|not found|scaduto/i.test(errMsg);
        if (isExpired) {
          await callOdoo(null, 'ir.attachment', 'write', [[att.id], { description: '' }]);
          states.push({ ...baseState, outcome: 'pending', detail: `RESET ${att.name} job=${jobId} expired, requeued` });
        } else {
          states.push({ ...baseState, outcome: 'pending', detail: `JOB STATUS ERR ${att.name}: ${errMsg.slice(0, 200)}` });
        }
      }
      continue;
    }

    // Caso 2: nessun job esistente -> ne avvio uno
    try {
      const [full] = await callOdoo(null, 'ir.attachment', 'read', [[att.id], ['datas']]);
      if (!full?.datas) throw new Error('attachment.datas vuoto');
      const start = await jetsonJobStart(att.name, full.datas, att.mimetype);
      const ts = Math.floor(Date.now() / 1000);
      await callOdoo(null, 'ir.attachment', 'write', [[att.id], { description: `${JOB_PREFIX}${start.job_id}:${ts}` }]);
      states.push({ ...baseState, outcome: 'pending', detail: `START ${att.name} job=${start.job_id}` });
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      await callOdoo(null, resModel, 'message_post', [[resId]], {
        body: buildChatterHtml({ status: 'failed', attachmentName: att.name, errorMessage: errMsg }),
        message_type: 'comment',
        subtype_xmlid: 'mail.mt_note',
      });
      states.push({ ...baseState, outcome: 'failed', detail: `FAIL START ${att.name}: ${errMsg.slice(0, 200)}` });
    }
  }

  return states;
}

function summarize(states: AttachState[]) {
  return {
    processed: states.filter((s) => s.outcome === 'done').length,
    skipped: states.filter((s) => s.outcome === 'skipped').length,
    failed: states.filter((s) => s.outcome === 'failed').length,
    pending: states.filter((s) => s.outcome === 'pending').length,
    details: states.map((s) => s.detail),
  };
}

// project.task (email): carica allegati, processa, applica il tag finale.
async function processTask(taskId: number, tagDoneId: number, tagFailedId: number) {
  const allAttachments: any[] = await callOdoo(null, 'ir.attachment', 'search_read', [
    [
      ['res_model', '=', 'project.task'],
      ['res_id', '=', taskId],
    ],
    ['id', 'name', 'mimetype', 'file_size', 'description'],
  ]);
  const hasCandidate = allAttachments.some(
    (a: any) => a.mimetype === 'application/pdf' || (a.mimetype || '').startsWith('image/'),
  );
  if (!hasCandidate) {
    await callOdoo(null, 'project.task', 'write', [[taskId], { tag_ids: [[4, tagDoneId]] }]);
    return { processed: 0, skipped: 0, failed: 0, pending: 0, details: ['Nessun allegato candidato'] };
  }

  const states = await processAttachmentList('project.task', taskId, allAttachments);
  const sum = summarize(states);

  if (sum.pending === 0) {
    const candidatesReali = states.filter((s) => s.outcome === 'done' || s.outcome === 'failed').length;
    if (candidatesReali === 0) {
      await callOdoo(null, 'project.task', 'write', [[taskId], { tag_ids: [[4, tagDoneId]] }]);
    } else {
      const tagId = sum.failed > 0 && sum.processed === 0 ? tagFailedId : tagDoneId;
      await callOdoo(null, 'project.task', 'write', [[taskId], { tag_ids: [[4, tagId]] }]);
    }
  }

  return sum;
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const log: any = { started_at: new Date(startedAt).toISOString(), tasks: [] };

  try {
    const tagDoneId = await ensureTag(TAG_OCR_DONE);
    const tagFailedId = await ensureTag(TAG_OCR_FAILED);
    log.tag_done_id = tagDoneId;
    log.tag_failed_id = tagFailedId;

    const totals = { processed: 0, skipped: 0, failed: 0, pending: 0 };
    let stoppedForTime = false;

    // 1. Email (project.task)
    const taskIds = await searchCandidateTasks(tagDoneId, tagFailedId);
    log.candidates = taskIds.length;
    for (const taskId of taskIds) {
      if (Date.now() - startedAt > SOFT_DEADLINE_MS) { stoppedForTime = true; break; }
      const t0 = Date.now();
      const r = await processTask(taskId, tagDoneId, tagFailedId);
      totals.processed += r.processed;
      totals.skipped += r.skipped;
      totals.failed += r.failed;
      totals.pending += r.pending;
      log.tasks.push({ model: 'project.task', task_id: taskId, wall_ms: Date.now() - t0, ...r });
    }

    // 2. Modelli extra (purchase.order, stock.picking, ...)
    log.models = {};
    for (const resModel of EXTRA_MODELS) {
      if (stoppedForTime || Date.now() - startedAt > SOFT_DEADLINE_MS) { stoppedForTime = true; break; }
      const grouped = await searchCandidateRecords(resModel);
      log.models[resModel] = grouped.size;
      for (const [resId, atts] of Array.from(grouped.entries())) {
        if (Date.now() - startedAt > SOFT_DEADLINE_MS) { stoppedForTime = true; break; }
        const t0 = Date.now();
        const states = await processAttachmentList(resModel, resId, atts);
        const r = summarize(states);
        totals.processed += r.processed;
        totals.skipped += r.skipped;
        totals.failed += r.failed;
        totals.pending += r.pending;
        log.tasks.push({ model: resModel, res_id: resId, wall_ms: Date.now() - t0, ...r });
      }
    }

    log.totals = totals;
    log.stopped_for_time = stoppedForTime;
    log.duration_ms = Date.now() - startedAt;
    console.log('[OCR-CRON]', JSON.stringify(log).slice(0, 4000));
    return NextResponse.json({ success: true, ...log });
  } catch (err: any) {
    log.error = err?.message || String(err);
    log.duration_ms = Date.now() - startedAt;
    console.error('[OCR-CRON] FATAL', err);
    return NextResponse.json({ success: false, ...log }, { status: 500 });
  }
}
