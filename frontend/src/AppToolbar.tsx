import {
  AppBar,
  Chip,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography,
  Box,
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

export function AppToolbar({
  activeClassifier,
  autoClassify,
  onClassifierChange,
  onAutoClassifyToggle,
  onClearAll,
  onClassifyAll,
}: {
  activeClassifier: string;
  autoClassify: boolean;
  onClassifierChange: (e: React.MouseEvent<HTMLElement>, value: string | null) => void;
  onAutoClassifyToggle: () => void;
  onClearAll: () => void;
  onClassifyAll: () => void;
}) {
  return (
    <AppBar position="static">
      <Toolbar>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Gmail Receipt Manager
          </Typography>
        </Box>
        <Tooltip title="Choose classification engine">
          <ToggleButtonGroup
            value={activeClassifier}
            exclusive
            onChange={onClassifierChange}
            size="small"
            sx={{
              bgcolor: 'rgba(255,255,255,0.15)',
              '& .MuiToggleButton-root': {
                color: 'rgba(255,255,255,0.7)',
                borderColor: 'rgba(255,255,255,0.3)',
                textTransform: 'none',
                px: 1.5,
                py: 0.25,
                fontSize: '0.8rem',
                '&.Mui-selected': {
                  color: '#fff',
                  fontWeight: 700,
                },
              },
            }}
          >
            <ToggleButton
              value="mock"
              sx={{ '&.Mui-selected': { bgcolor: 'rgba(255,180,50,0.5)', '&:hover': { bgcolor: 'rgba(255,180,50,0.65)' } } }}
            >
              Mock
            </ToggleButton>
            <ToggleButton
              value="ollama"
              sx={{ '&.Mui-selected': { bgcolor: 'rgba(80,200,80,0.5)', '&:hover': { bgcolor: 'rgba(80,200,80,0.65)' } } }}
            >
              Ollama
            </ToggleButton>
          </ToggleButtonGroup>
        </Tooltip>
        <Tooltip title="Auto-classify emails as they load">
          <Chip
            label={autoClassify ? 'Auto: ON' : 'Auto: OFF'}
            onClick={onAutoClassifyToggle}
            size="small"
            sx={{
              ml: 1.5,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.75rem',
              color: '#fff',
              bgcolor: autoClassify ? 'rgba(100,200,100,0.5)' : 'rgba(255,255,255,0.15)',
              border: '1px solid',
              borderColor: autoClassify ? 'rgba(100,255,100,0.5)' : 'rgba(255,255,255,0.3)',
              '&:hover': { bgcolor: autoClassify ? 'rgba(100,200,100,0.7)' : 'rgba(255,255,255,0.25)' },
            }}
          />
        </Tooltip>
        <Tooltip title="Reset all classifications">
          <IconButton
            onClick={onClearAll}
            sx={{ ml: 1, color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }}
            size="small"
          >
            <RestartAltIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Classify all emails">
          <IconButton
            onClick={onClassifyAll}
            sx={{ ml: 0.5, color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }}
            size="small"
          >
            <PlayArrowIcon />
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
}
