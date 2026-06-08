import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import {
  fetchLabels,
  fetchLedger,
  fetchMonths,
  fetchReceipt,
  fetchReceipts,
  type LabelCount,
  type Ledger,
  type Receipt,
  type ReceiptSummary,
} from "./api";
import { CURRENT_YEAR, pad } from "./constants";
import { AppHeader } from "./components/AppHeader";
import { LabelChips } from "./components/LabelChips";
import { ResizeHandle } from "./components/ResizeHandle";
import { MonthPicker } from "./components/MonthPicker";
import { ReceiptList } from "./components/ReceiptList";
import { ReceiptDetail } from "./components/ReceiptDetail";

export const App = () => {
  const [months, setMonths] = useState<string[]>([]);
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [monthNum, setMonthNum] = useState<number>(new Date().getMonth() + 1);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [receipts, setReceipts] = useState<ReceiptSummary[]>([]);
  const [selected, setSelected] = useState<Receipt | null>(null);
  const [labels, setLabels] = useState<LabelCount[]>([]);
  const [onLabels, setOnLabels] = useState<Set<string>>(new Set());
  const [sidebarWidth, setSidebarWidth] = useState<number>(360);

  const month = `${year}-${pad(monthNum)}`;

  // Gather every label (with all-months counts) once on startup, and start
  // with all of them switched on so the list is unfiltered.
  useEffect(() => {
    fetchLabels().then((list) => {
      setLabels(list);
      setOnLabels(new Set(list.map((l) => l.label)));
    });
  }, []);

  const toggleLabel = (label: string) => {
    setOnLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  // Show a receipt when any of its labels is switched on. Receipts with no
  // labels have nothing to switch off, so they always show.
  const visibleReceipts = receipts.filter(
    (r) => r.labels.length === 0 || r.labels.some((l) => onLabels.has(l)),
  );

  // Load the months that have data and select the newest one; if there are
  // none, the selection stays on the current month (the initial state).
  useEffect(() => {
    fetchMonths().then((list) => {
      setMonths(list);
      if (list.length > 0) {
        const [y, m] = list[0].split("-");
        setYear(Number(y));
        setMonthNum(Number(m));
      }
    });
  }, []);

  // When the chosen month changes, load its receipts and ledger summary. Only
  // months that have data exist on the backend, so skip the request (and the
  // 404) for empty months.
  useEffect(() => {
    setSelected(null);
    if (!months.includes(month)) {
      setReceipts([]);
      setLedger(null);
      return;
    }
    fetchReceipts(month).then(setReceipts);
    fetchLedger(month).then(setLedger);
  }, [month, months]);

  const openReceipt = (baseName: string) => {
    fetchReceipt(month, baseName).then(setSelected);
  };

  // Trigger a fetch for the selected month. Not wired to the backend yet;
  // for now it just shows the date range that would be sent.
  const runFetch = () => {
    const since = `${month}-01`;
    const before =
      monthNum === 12
        ? `${year + 1}-01-01`
        : `${year}-${pad(monthNum + 1)}-01`;
    alert(`Run fetch with:\nFETCH_SINCE=${since}\nFETCH_BEFORE=${before}`);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <AppHeader />

      <LabelChips labels={labels} selected={onLabels} onToggle={toggleLabel} />

      <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Box
          component="aside"
          sx={{
            width: sidebarWidth,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            p: 2,
          }}
        >
          <MonthPicker
            months={months}
            year={year}
            monthNum={monthNum}
            month={month}
            onYearChange={setYear}
            onMonthChange={setMonthNum}
            onRunFetch={runFetch}
          />

          <ReceiptList
            ledger={ledger}
            receipts={visibleReceipts}
            selectedBaseName={selected?.base_name}
            onSelect={openReceipt}
          />
        </Box>

        <ResizeHandle onResize={setSidebarWidth} />

        <Box component="main" sx={{ flex: 1, overflowY: "auto", p: 3 }}>
          {selected ? (
            <ReceiptDetail month={month} receipt={selected} />
          ) : (
            <Typography color="text.disabled" sx={{ mt: 8, textAlign: "center" }}>
              Select a receipt
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};
