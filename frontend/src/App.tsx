import { useEffect, useState } from 'react';
import {
  Box,
  CircularProgress,
  Container,
  Alert,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import type { TabValue } from './email-status';
import { useEmailStore } from './useEmailStore';
import { AppToolbar } from './AppToolbar';
import { StatsBar } from './StatsBar';
import { DateFilter } from './DateFilter';
import { EmailTable } from './EmailTable';

function App() {
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [dateFrom, setDateFrom] = useState(() => new URLSearchParams(window.location.search).get('from') ?? '');
  const [dateTo, setDateTo] = useState(() => new URLSearchParams(window.location.search).get('to') ?? '');

  const store = useEmailStore({ dateFrom, dateTo });

  // Sync date filters to URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (dateFrom) params.set('from', dateFrom); else params.delete('from');
    if (dateTo) params.set('to', dateTo); else params.delete('to');
    const qs = params.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [dateFrom, dateTo]);

  const displayedEmails =
    activeTab === 'receipts'
      ? store.emails.filter((e) => store.receiptIds.has(e.id))
      : store.emails;

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
      <AppToolbar
        activeClassifier={store.activeClassifier}
        autoClassify={store.autoClassify}
        onClassifierChange={store.handleClassifierChange}
        onAutoClassifyToggle={() => store.setAutoClassify(prev => !prev)}
        onClearAll={store.handleClearAll}
        onClassifyAll={store.handleClassifyAll}
      />

      <Container maxWidth="lg" sx={{ pt: 1, pb: 0, flexShrink: 0 }}>
        <StatsBar
          totalEmails={store.emailsTotal}
          totalReceipts={store.activeReceiptCount}
          totalNonReceipts={store.classifiedNonReceipts}
          classifying={store.processingCount}
        />
        <DateFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onClear={() => { setDateFrom(''); setDateTo(''); }}
        />
        {store.error && (
          <Alert severity="error" sx={{ mb: 0.5, py: 0 }}>
            {store.error}
          </Alert>
        )}
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40 } }}
        >
          <Tab label="All Emails" value="all" />
          <Tab label="Receipts Only" value="receipts" />
        </Tabs>
      </Container>

      <Container maxWidth="lg" sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', pb: 0 }}>
        {store.loading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={28} />
            <Typography variant="body2" sx={{ mt: 1 }} color="text.secondary">
              Loading emails...
            </Typography>
          </Box>
        ) : (
          <EmailTable
            emails={displayedEmails}
            hasMore={store.emailsHasMore}
            loadingMore={store.loadingMore}
            receiptByEmailId={store.receiptByEmailId}
            getEmailStatus={store.getEmailStatus}
            onLoadMore={store.loadMoreEmails}
            onReclassify={(id) => store.submitClassification([id], true)}
          />
        )}
      </Container>
    </Box>
  );
}

export default App;
