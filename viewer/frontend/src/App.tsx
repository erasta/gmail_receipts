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
  type ReceiptRow,
} from "./api";
import { CURRENT_YEAR, pad } from "./constants";
import { AppHeader } from "./components/AppHeader";
import { LabelChips } from "./components/LabelChips";
import { ResizeHandle } from "./components/ResizeHandle";
import { MonthPicker } from "./components/MonthPicker";
import { ReceiptFilter, type FilterField } from "./components/ReceiptFilter";
import { ReceiptList } from "./components/ReceiptList";
import { ReceiptDetail } from "./components/ReceiptDetail";

export const App = () => {
  const [months, setMonths] = useState<string[]>([]);
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [selectedMonths, setSelectedMonths] = useState<Set<number>>(
    new Set([new Date().getMonth() + 1]),
  );
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [selected, setSelected] = useState<Receipt | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [labels, setLabels] = useState<LabelCount[]>([]);
  const [onLabels, setOnLabels] = useState<Set<string>>(new Set());
  const [sidebarWidth, setSidebarWidth] = useState<number>(360);
  const [filterText, setFilterText] = useState<string>("");
  const [filterFields, setFilterFields] = useState<Set<FilterField>>(
    new Set(["subject", "body", "addresses"]),
  );

  const toggleFilterField = (field: FilterField) => {
    setFilterFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  };

  // The chosen months for the current year that actually have data, as
  // "YYYY-MM" strings. Sorted so the merged list and ledger are stable.
  const activeMonths = [...selectedMonths]
    .map((m) => `${year}-${pad(m)}`)
    .filter((m) => months.includes(m))
    .sort();

  const toggleMonth = (monthNum: number) => {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthNum)) {
        next.delete(monthNum);
      } else {
        next.add(monthNum);
      }
      return next;
    });
  };

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
  const labelFiltered = receipts.filter(
    (r) => r.labels.length === 0 || r.labels.some((l) => onLabels.has(l)),
  );

  // Then narrow by the text box: an empty box shows everything; otherwise a
  // receipt stays only if the text appears in one of the switched-on fields
  // (subject, body, or any address: to/from/cc).
  const needle = filterText.trim().toLowerCase();
  const visibleReceipts = labelFiltered.filter((r) => {
    if (needle === "") return true;
    const haystacks: (string | null)[] = [];
    if (filterFields.has("subject")) haystacks.push(r.subject);
    if (filterFields.has("body")) haystacks.push(r.body);
    if (filterFields.has("addresses")) haystacks.push(r.from, r.to, r.cc);
    return haystacks.some((h) => h?.toLowerCase().includes(needle));
  });

  // Load the months that have data and select the newest one; if there are
  // none, the selection stays on the current month (the initial state).
  useEffect(() => {
    fetchMonths().then((list) => {
      setMonths(list);
      if (list.length > 0) {
        const [y, m] = list[0].split("-");
        setYear(Number(y));
        setSelectedMonths(new Set([Number(m)]));
      }
    });
  }, []);

  // When the chosen months change, load each one's receipts and ledger, then
  // merge them. Each receipt is tagged with its month so it can still be
  // opened. The combined list is sorted by base_name, which is a timestamp,
  // giving a chronological order across months.
  useEffect(() => {
    setSelected(null);
    if (activeMonths.length === 0) {
      setReceipts([]);
      setLedger(null);
      return;
    }
    let cancelled = false;

    Promise.all(
      activeMonths.map((m) =>
        fetchReceipts(m).then((rows) =>
          rows.map((r) => ({ ...r, month: m })),
        ),
      ),
    ).then((perMonth) => {
      if (cancelled) return;
      const merged = perMonth
        .flat()
        .sort((a, b) => a.base_name.localeCompare(b.base_name));
      setReceipts(merged);
    });

    Promise.all(activeMonths.map((m) => fetchLedger(m))).then((perMonth) => {
      if (cancelled) return;
      setLedger({
        seen: perMonth.reduce((sum, l) => sum + l.seen, 0),
        receipts: perMonth.reduce((sum, l) => sum + l.receipts, 0),
      });
    });

    return () => {
      cancelled = true;
    };
    // activeMonths is rebuilt each render; join it to a stable dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMonths.join(",")]);

  const openReceipt = (m: string, baseName: string) => {
    fetchReceipt(m, baseName).then((r) => {
      setSelected(r);
      setSelectedMonth(m);
    });
  };

  // Trigger a fetch spanning the chosen months. Not wired to the backend yet;
  // for now it just shows the date range that would be sent.
  const runFetch = () => {
    if (activeMonths.length === 0) return;
    const first = activeMonths[0];
    const last = activeMonths[activeMonths.length - 1];
    const [ly, lm] = last.split("-").map(Number);
    const since = `${first}-01`;
    const before =
      lm === 12 ? `${ly + 1}-01-01` : `${ly}-${pad(lm + 1)}-01`;
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
            selectedMonths={selectedMonths}
            onYearChange={setYear}
            onMonthToggle={toggleMonth}
            onRunFetch={runFetch}
          />

          <ReceiptFilter
            text={filterText}
            fields={filterFields}
            onTextChange={setFilterText}
            onToggleField={toggleFilterField}
          />

          <ReceiptList
            ledger={ledger}
            receipts={visibleReceipts}
            selectedKey={
              selected ? `${selectedMonth}:${selected.base_name}` : undefined
            }
            onSelect={openReceipt}
          />
        </Box>

        <ResizeHandle onResize={setSidebarWidth} />

        <Box component="main" sx={{ flex: 1, overflowY: "auto", p: 3 }}>
          {selected ? (
            <ReceiptDetail month={selectedMonth} receipt={selected} />
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
