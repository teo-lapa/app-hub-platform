import { NextRequest, NextResponse } from 'next/server';
import { callOdoo } from '@/lib/odoo-auth';
import {
  EMAIL_PROJECT_IDS,
  TAG_OCR_DONE,
  TAG_OCR_FAILED,
  isJunkAttachment,
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

const LOOKBACK_DAYS = parseInt(process.env.OCR_CRON_LOOKBACK_DAYS || '7', 10);
const MAX_TASKS_PER_RUN = parseInt(process.env.OCR_CRON_MAX_TASKS || '20', 10);
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

async function searchCandidateTasks(doneTagId: number, failedTagId: number): Promise<number[]> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
  return (await callOdoo(
    null,
    'project.task',
    'search',
    [[
      ['project_id', 'in', EMAIL_PROJECT_IDS],
      ['create_date', '>=', since],
      ['tag_ids', 'not in', [doneTagId, failedTagId]],
    ]],
    { limit: MAX_TASKS_PER_RUN, order: 'create_date desc' },
  )) as number[];
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

async function processTask(taskId: number, tagDoneId: number, tagFailedId: number) {
  const states: AttachState[] = [];
  const attachments: any[] = await callOdoo(null, 'ir.attachment', 'search_read', [
    [
      ['res_model', '=', 'project.task'],
      ['res_id', '=', taskId],
      '|',
      ['mimetype', '=', 'application/pdf'],
      ['mimetype', 'like', 'image/%'],
    ],
    ['id', 'name', 'mimetype', 'file_size', 'description'],
  ]);

  if (!Array.isArray(attachments) || attachments.length === 0) {
    await callOdoo(null, 'project.task', 'write', [[taskId], { tag_ids: [[4, tagDoneId]] }]);
    return { processed: 0, skipped: 0, failed: 0, pending: 0, details: ['Nessun allegato candidato'] };
  }

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
          await callOdoo(null, 'project.task', 'message_post', [[taskId]], {
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
          res_model: 'project.task',
          res_id: taskId,
          type: 'binary',
          datas: mdBase64,
          mimetype: 'text/markdown',
        }]);
        await callOdoo(null, 'project.task', 'message_post', [[taskId]], {
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
        states.push({ ...baseState, outcome: 'pending', detail: `JOB STATUS ERR ${att.name}: ${errMsg.slice(0, 200)}` });
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
      await callOdoo(null, 'project.task', 'message_post', [[taskId]], {
        body: buildChatterHtml({ status: 'failed', attachmentName: att.name, errorMessage: errMsg }),
        message_type: 'comment',
        subtype_xmlid: 'mail.mt_note',
      });
      states.push({ ...baseState, outcome: 'failed', detail: `FAIL START ${att.name}: ${errMsg.slice(0, 200)}` });
    }
  }

  // Tag finale: solo se NESSUN allegato e' pending
  const pending = states.filter((s) => s.outcome === 'pending').length;
  const done = states.filter((s) => s.outcome === 'done').length;
  const failed = states.filter((s) => s.outcome === 'failed').length;
  const skipped = states.filter((s) => s.outcome === 'skipped').length;

  if (pending === 0) {
    const tagId = failed > 0 && done === 0 ? tagFailedId : tagDoneId;
    await callOdoo(null, 'project.task', 'write', [[taskId], { tag_ids: [[4, tagId]] }]);
  }

  return {
    processed: done,
    skipped,
    failed,
    pending,
    details: states.map((s) => s.detail),
  };
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

    const taskIds = await searchCandidateTasks(tagDoneId, tagFailedId);
    log.candidates = taskIds.length;

    let totals = { processed: 0, skipped: 0, failed: 0, pending: 0 };
    let stoppedForTime = false;

    for (const taskId of taskIds) {
      if (Date.now() - startedAt > SOFT_DEADLINE_MS) {
        stoppedForTime = true;
        break;
      }
      const t0 = Date.now();
      const r = await processTask(taskId, tagDoneId, tagFailedId);
      totals.processed += r.processed;
      totals.skipped += r.skipped;
      totals.failed += r.failed;
      totals.pending += r.pending;
      log.tasks.push({ task_id: taskId, wall_ms: Date.now() - t0, ...r });
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
