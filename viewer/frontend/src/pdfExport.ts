import { PDFDocument } from "pdf-lib";
import { attachmentUrl, fetchReceipt, receiptPdfUrl } from "./api";
import { isPdf } from "./constants";

const fetchBytes = (url: string) => fetch(url).then((r) => r.arrayBuffer());

// Copy one PDF's pages onto the end of the merged document.
const appendPdf = async (merged: PDFDocument, bytes: ArrayBuffer) => {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = await merged.copyPages(doc, doc.getPageIndices());
  pages.forEach((page) => merged.addPage(page));
};

// Append a receipt: its backend-rendered email PDF, then its PDF attachments.
// Returns how many input bytes were added, for size tracking.
const appendReceipt = async (
  merged: PDFDocument,
  month: string,
  baseName: string,
  attachments: string[],
): Promise<number> => {
  let added = 0;
  const append = async (bytes: ArrayBuffer) => {
    added += bytes.byteLength;
    await appendPdf(merged, bytes);
  };
  await append(await fetchBytes(receiptPdfUrl(month, baseName)));
  for (const name of attachments.filter(isPdf)) {
    await append(await fetchBytes(attachmentUrl(month, baseName, name)));
  }
  return added;
};

// One receipt -> a PDF blob (rendered email plus its PDF attachments).
export const buildReceiptPdf = async (
  month: string,
  baseName: string,
  attachments: string[],
): Promise<Blob> => {
  const merged = await PDFDocument.create();
  await appendReceipt(merged, month, baseName, attachments);
  return new Blob([new Uint8Array(await merged.save())], {
    type: "application/pdf",
  });
};

// The merged PDF, or "too big" if it crossed limitBytes mid-build (we stop
// there rather than finish rendering the rest). `mb` is the size so far.
export type MarkedPdfResult =
  | { tooBig: false, blob: Blob }
  | { tooBig: true, mb: number };

// Many receipts -> one PDF, in the order given. Each target's attachments are
// fetched per receipt; an orphaned mark (deleted file) is skipped. Stops early
// once the running size passes limitBytes.
export const buildMarkedPdf = async (
  targets: { month: string, baseName: string }[],
  limitBytes: number,
): Promise<MarkedPdfResult> => {
  const merged = await PDFDocument.create();
  let total = 0;
  for (const { month, baseName } of targets) {
    let attachments: string[];
    try {
      attachments = (await fetchReceipt(month, baseName)).attachments;
    } catch {
      continue; // marked file was deleted; skip this orphaned mark
    }
    total += await appendReceipt(merged, month, baseName, attachments);
    if (total > limitBytes) {
      return { tooBig: true, mb: Math.round(total / 1024 / 1024) };
    }
  }
  const blob = new Blob([new Uint8Array(await merged.save())], {
    type: "application/pdf",
  });
  return { tooBig: false, blob };
};
