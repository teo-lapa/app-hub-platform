import { NextRequest, NextResponse } from 'next/server';
import { callOdoo } from '@/lib/odoo-auth';
import {
  EMAIL_PROJECT_IDS,
  TAG_OCR_DONE,
  TAG_OCR_FAILED,
  isJunkAttachment,
  callJetsonOCR,
  buildCleanedName,
  imageFallbackName,
  extensionOf,
  buildChatterHtml,
  type OCRHeader,
} from '@/lib/ocr/attachments-pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min Vercel cap

const LOOKBACK_DAYS = parseInt(process.env.OCR_CRON_LOOKBACK_DAYS || '7', 10);
const MAX_TASKS_PER_RUN = parseInt(process.env.OCR_CRON_MAX_TASKS || '8', 10);
const SOFT_DEADLINE_MS = 240_000; // 4 min, lasciamo buffer su 5 min

// ---------------------------------------------------------------------------
// Tag helpers
// ---------------------------------------------------------------------------
async function ensureTag(name: string): Promise<number> {
  const existing = await callOdoo(null, 'project.tags', 'search_read', [
    [['name', '=', name]],
    ['id', 'name'],
  ]);
  if (existing.length > 0) return existing[0].id;
  return await callOdoo(null, 'project.tags', 'create', [{ name }]);
}

// ---------------------------------------------------------------------------
// Search candidates
// ---------------------------------------------------------------------------
async function searchCandidateTasks(doneTagId: number, failedTagId: number): Promise<number[]> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
  const tasks = await callOdoo(
    null,
    'project.task',
    'search',
    [[
      ['project_id', 'in', EMAIL_PROJECT_IDS],
      ['create_date', '>=', since],
      ['tag_ids', 'not in', [doneTagId, failedTagId]],
    ]],
    { limit: MAX_TASKS_PER_RUN * 4, order: 'create_date desc' },
  );
  return tasks as number[];
}

// ---------------------------------------------------------------------------
// Per-task processor
// ---------------------------------------------------------------------------
async function processTask(taskId: number, tagDoneId: number, tagFailedId: number) {
  const summary: { processed: number; skipped: number; failed: number; details: string[] } = {
    processed: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  // Lista attachments del task (escludi quelli .md gia creati da noi)
  const attachments = await callOdoo(null, 'ir.attachment', 'search_read', [
    [
      ['res_model', '=', 'project.task'],
      ['res_id', '=', taskId],
      '|',
      ['mimetype', '=', 'application/pdf'],
      ['mimetype', 'like', 'image/%'],
    ],
    ['id', 'name', 'mimetype', 'file_size'],
  ]);

  if (!Array.isArray(attachments) || attachments.length === 0) {
    summary.details.push(`Nessun allegato candidato`);
    await callOdoo(null, 'project.task', 'write', [[taskId], { tag_ids: [[4, tagDoneId]] }]);
    return summary;
  }

  let anyFailed = false;
  let anyProcessed = false;

  for (const att of attachments) {
    const filter = isJunkAttachment(att.name, att.file_size, att.mimetype);
    if (filter.skip) {
      summary.skipped++;
      summary.details.push(`SKIP ${att.name}: ${filter.reason}`);
      continue;
    }

    try {
      // Scarica datas (base64)
      const [full] = await callOdoo(null, 'ir.attachment', 'read', [[att.id], ['datas']]);
      if (!full?.datas) {
        throw new Error('attachment.datas vuoto');
      }

      // Chiamata OCR Jetson
      const ocr = await callJetsonOCR(att.name, full.datas, att.mimetype);

      const header = ocr.header as OCRHeader | undefined;
      const ext = extensionOf(att.name) || (att.mimetype === 'application/pdf' ? '.pdf' : '.jpg');

      // Costruisci nome nuovo
      let newName: string;
      if (header && (header.doc_type || header.vendor)) {
        newName = buildCleanedName(att.name, header, ext);
      } else if (att.mimetype.startsWith('image/')) {
        newName = imageFallbackName(att.name);
      } else {
        newName = att.name; // mantieni se non classificabile
      }

      // 1) Rinomina PDF/immagine originale
      if (newName !== att.name) {
        await callOdoo(null, 'ir.attachment', 'write', [[att.id], { name: newName }]);
      }

      // 2) Crea attachment MD
      const cleanedMd = ocr.cleaned_markdown || ocr.markdown || '';
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

      // 3) Chatter
      const chatterHtml = buildChatterHtml({
        status: 'ok',
        attachmentName: att.name,
        newName,
        header,
        wallTimeSec: Math.round(ocr.wall_time_s),
        numPages: ocr.num_pages,
        mdAttachmentId,
        mdPreview: cleanedMd.slice(0, 600),
      });
      await callOdoo(null, 'project.task', 'message_post', [[taskId]], {
        body: chatterHtml,
        message_type: 'comment',
        subtype_xmlid: 'mail.mt_note',
      });

      summary.processed++;
      summary.details.push(`OK ${att.name} -> ${newName} (${ocr.num_pages}p, ${Math.round(ocr.wall_time_s)}s)`);
      anyProcessed = true;
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error(`[OCR-CRON] task=${taskId} att=${att.id} ${att.name} FAIL: ${errMsg}`);
      summary.failed++;
      summary.details.push(`FAIL ${att.name}: ${errMsg}`);
      anyFailed = true;

      // Chatter di errore
      try {
        await callOdoo(null, 'project.task', 'message_post', [[taskId]], {
          body: buildChatterHtml({ status: 'failed', attachmentName: att.name, errorMessage: errMsg }),
          message_type: 'comment',
          subtype_xmlid: 'mail.mt_note',
        });
      } catch (e) {
        console.error('chatter post failed:', e);
      }
    }
  }

  // Tag finale
  const tagId = anyFailed && !anyProcessed ? tagFailedId : tagDoneId;
  await callOdoo(null, 'project.task', 'write', [[taskId], { tag_ids: [[4, tagId]] }]);

  return summary;
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  // Auth
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

    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let stoppedForTime = false;

    for (const taskId of taskIds) {
      if (Date.now() - startedAt > SOFT_DEADLINE_MS) {
        stoppedForTime = true;
        break;
      }
      const t0 = Date.now();
      const r = await processTask(taskId, tagDoneId, tagFailedId);
      totalProcessed += r.processed;
      totalSkipped += r.skipped;
      totalFailed += r.failed;
      log.tasks.push({
        task_id: taskId,
        wall_ms: Date.now() - t0,
        ...r,
      });
    }

    log.totals = { processed: totalProcessed, skipped: totalSkipped, failed: totalFailed };
    log.stopped_for_time = stoppedForTime;
    log.duration_ms = Date.now() - startedAt;

    console.log('[OCR-CRON]', JSON.stringify(log, null, 2));
    return NextResponse.json({ success: true, ...log });
  } catch (err: any) {
    log.error = err?.message || String(err);
    log.duration_ms = Date.now() - startedAt;
    console.error('[OCR-CRON] FATAL', err);
    return NextResponse.json({ success: false, ...log }, { status: 500 });
  }
}
