import { useEffect, useState } from "react";
import {
  attachmentUrl,
  fetchLedger,
  fetchMonths,
  fetchReceipt,
  fetchReceipts,
  type Ledger,
  type Receipt,
  type ReceiptSummary,
} from "./api";
import "./App.css";

const isImage = (filename: string) =>
  /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(filename);
const isPdf = (filename: string) => /\.pdf$/i.test(filename);

export const App = () => {
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState<string>("");
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [receipts, setReceipts] = useState<ReceiptSummary[]>([]);
  const [selected, setSelected] = useState<Receipt | null>(null);

  // Load the list of months once, and pick the newest as the default.
  useEffect(() => {
    fetchMonths().then((list) => {
      setMonths(list);
      if (list.length > 0) {
        setMonth(list[0]);
      }
    });
  }, []);

  // When the chosen month changes, load its receipts and ledger summary.
  useEffect(() => {
    if (!month) {
      return;
    }
    setSelected(null);
    fetchReceipts(month).then(setReceipts);
    fetchLedger(month).then(setLedger);
  }, [month]);

  const openReceipt = (baseName: string) => {
    fetchReceipt(month, baseName).then(setSelected);
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Receipts</h1>
        <select value={month} onChange={(e) => setMonth(e.target.value)}>
          {months.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {ledger && (
          <p className="summary">
            {ledger.receipts} receipts / {ledger.seen} emails seen
          </p>
        )}
        <ul className="receipt-list">
          {receipts.map((r) => (
            <li
              key={r.base_name}
              className={
                selected?.base_name === r.base_name ? "active" : undefined
              }
              onClick={() => openReceipt(r.base_name)}
            >
              <div className="row-subject">{r.subject || "(no subject)"}</div>
              <div className="row-from">{r.from}</div>
              <div className="row-meta">
                <span>{r.date}</span>
                {r.attachments.length > 0 && (
                  <span className="badge">📎 {r.attachments.length}</span>
                )}
              </div>
            </li>
          ))}
          {receipts.length === 0 && <li className="empty">No receipts</li>}
        </ul>
      </aside>

      <main className="detail">
        {selected ? (
          <ReceiptDetail month={month} receipt={selected} />
        ) : (
          <div className="placeholder">Select a receipt</div>
        )}
      </main>
    </div>
  );
};

const ReceiptDetail = ({
  month,
  receipt,
}: {
  month: string;
  receipt: Receipt;
}) => {
  const c = receipt.classification;
  return (
    <div className="receipt">
      <h2>{receipt.subject || "(no subject)"}</h2>
      <dl className="fields">
        <dt>From</dt>
        <dd>{receipt.from}</dd>
        <dt>Date</dt>
        <dd>{receipt.date}</dd>
        <dt>UID</dt>
        <dd>{receipt.uid}</dd>
      </dl>

      {c && (
        <div className="classification">
          <span className="badge">
            confidence {(c.confidence * 100).toFixed(0)}%
          </span>
          <span className="reason">{c.reason}</span>
        </div>
      )}

      {receipt.attachments.length > 0 && (
        <section className="attachments">
          <h3>Attachments</h3>
          {receipt.attachments.map((filename) => {
            const url = attachmentUrl(month, receipt.base_name, filename);
            return (
              <div key={filename} className="attachment">
                <a href={url} target="_blank" rel="noreferrer">
                  {filename}
                </a>
                {isImage(filename) && <img src={url} alt={filename} />}
                {isPdf(filename) && <iframe src={url} title={filename} />}
              </div>
            );
          })}
        </section>
      )}

      <section className="body">
        <h3>Body</h3>
        <pre>{receipt.body}</pre>
      </section>
    </div>
  );
};
