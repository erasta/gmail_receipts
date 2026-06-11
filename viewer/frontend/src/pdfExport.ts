import { PDFDocument } from "pdf-lib";
import { attachmentUrl, receiptPdfUrl } from "./api";
import { isPdf } from "./constants";

const fetchBytes = (url: string) => fetch(url).then((r) => r.arrayBuffer());

// Copy one PDF's pages onto the end of the merged document.
const appendPdf = async (merged: PDFDocument, bytes: ArrayBuffer) => {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = await merged.copyPages(doc, doc.getPageIndices());
  pages.forEach((page) => merged.addPage(page));
};

// Append a receipt: its backend-rendered email PDF, then its PDF attachments.
const appendReceipt = async (
  merged: PDFDocument,
  month: string,
  baseName: string,
  attachments: string[],
) => {
  await appendPdf(merged, await fetchBytes(receiptPdfUrl(month, baseName)));
  for (const name of attachments.filter(isPdf)) {
    await appendPdf(merged, await fetchBytes(attachmentUrl(month, baseName, name)));
  }
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
