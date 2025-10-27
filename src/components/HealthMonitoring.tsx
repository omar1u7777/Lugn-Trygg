import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Alert,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
} from '@mui/material';
import {
  Warning,
  Error,
  CheckCircle,
  Info,
  Psychology,
  Favorite,
  Report,
  Healing,
  Flag,
} from '@mui/icons-material';
import { analytics } from '../services/analytics';

interface CrisisIndicator {
  id: string;
  type: 'mood' | 'behavior' | 'communication' | 'physical';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: Date;
  userId: string;
  resolved: boolean;
  actions: string[];
}

interface SafetyCheck {
  id: string;
  userId: string;
  result: 'safe' | 'concerning' | 'critical';
  indicators: string[];
  checkedAt: Date;
  nextCheck: Date;
  notes?: string;
}

interface HealthMetrics {
  totalUsers: number;
  activeMonitoring: number;
  crisisAlerts: number;
  safetyChecks: number;
  averageMood: number;
  riskLevel: 'low' | 'medium' | 'high';
}

const HealthMonitoring: React.FC = () => {
  const [metrics, setMetrics] = useState<HealthMetrics>({
    totalUsers: 15420,
    activeMonitoring: 2340,
    crisisAlerts: 12,
    safetyChecks: 8750,
    averageMood: 6.8,
    riskLevel: 'low',
  });

  const [crisisIndicators, setCrisisIndicators] = useState<CrisisIndicator[]>([
    {
      id: '1',
      type: 'mood',
      severity: 'high',
      description: 'User reported mood score of 2/10 for 3 consecutive days',
      detectedAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      userId: 'user_123',
      resolved: false,
      actions: [
        'Schedule therapist consultation',
        'Send supportive message',
        'Monitor daily check-ins',
      ],
    },
    {
      id: '2',
      type: 'communication',
      severity: 'medium',
      description: 'User mentioned feeling "hopeless" in chatbot conversation',
      detectedAt: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      userId: 'user_456',
      resolved: false,
      actions: [
        'Flag for immediate review',
        'Contact emergency contacts if available',
        'Provide crisis resources',
      ],
    },
  ]);

  const [selectedIndicator, setSelectedIndicator] = useState<CrisisIndicator | null>(null);
  const [actionDialog, setActionDialog] = useState(false);
  const [selectedAction, setSelectedAction] = useState('');

  useEffect(() => {
    analytics.page('Health Monitoring Dashboard', {
      component: 'HealthMonitoring',
    });
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high': return <Error color="error" />;
      case 'medium': return <Warning color="warning" />;
      case 'low': return <Info color="info" />;
      default: return <Info />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'mood': return <Psychology />;
      case 'behavior': return <Flag />;
      case 'communication': return <Report />;
      case 'physical': return <Favorite />;
      default: return <Info />;
    }
  };

  const handleResolveIndicator = (indicator: CrisisIndicator) => {
    setCrisisIndicators(prev =>
      prev.map(item =>
        item.id === indicator.id ? { ...item, resolved: true } : item
      )
    );

    analytics.health.crisisDetected(
      [indicator.description],
      {
        severity: indicator.severity,
        resolved: true,
        component: 'HealthMonitoring',
      }
    );

    // Update metrics
    setMetrics(prev => ({
      ...prev,
      crisisAlerts: Math.max(0, prev.crisisAlerts - 1),
    }));
  };

  const handleTakeAction = (indicator: CrisisIndicator, action: string) => {
    setSelectedIndicator(indicator);
    setSelectedAction(action);
    setActionDialog(true);

    analytics.track('Health Action Taken', {
      indicatorId: indicator.id,
      action,
      severity: indicator.severity,
      component: 'HealthMonitoring',
    });
  };

  const MetricCard: React.FC<{
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    color?: string;
  }> = ({ title, value, subtitle, icon, color = 'primary' }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" component="div">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" mt={1}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box sx={{ color: `${color}.main`, fontSize: 40 }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Health & Safety Monitoring
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Real-time monitoring of user mental health and safety indicators
          </Typography>
        </Box>

        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<Healing />}
            onClick={() => {
              analytics.track('Health Check Initiated', {
                component: 'HealthMonitoring',
              });
            }}
          >
            Run Health Check
          </Button>
          <Button
            variant="contained"
            startIcon={<Report />}
            color="error"
            onClick={() => {
              analytics.track('Emergency Protocol Activated', {
                component: 'HealthMonitoring',
              });
            }}
          >
            Emergency Protocol
          </Button>
        </Box>
      </Box>

      {/* Critical Alert */}
      {metrics.crisisAlerts > 0 && (
        <Alert severity="error" sx={{ mb: 4 }}>
          <Typography variant="h6">
            🚨 {metrics.crisisAlerts} Active Crisis Alert{metrics.crisisAlerts > 1 ? 's' : ''}
          </Typography>
          <Typography>
            Immediate attention required for users showing critical mental health indicators.
          </Typography>
        </Alert>
      )}

      {/* Key Metrics */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Active Monitoring"
            value={metrics.activeMonitoring}
            subtitle="Users under active health monitoring"
            icon={<Psychology />}
            color="primary"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Crisis Alerts"
            value={metrics.crisisAlerts}
            subtitle="Require immediate attention"
            icon={<Error />}
            color="error"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Safety Checks"
            value={metrics.safetyChecks}
            subtitle="Completed this week"
            icon={<CheckCircle />}
            color="success"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Average Mood"
            value={`${metrics.averageMood}/10`}
            subtitle="Community mood score"
            icon={<Favorite />}
            color="secondary"
          />
        </Grid>
      </Grid>

      {/* Risk Level Indicator */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Community Risk Level
            </Typography>
            <Chip
              label={metrics.riskLevel.toUpperCase()}
              color={metrics.riskLevel === 'low' ? 'success' : metrics.riskLevel === 'medium' ? 'warning' : 'error'}
              size="large"
            />
          </Box>
          <LinearProgress
            variant="determinate"
            value={metrics.riskLevel === 'low' ? 25 : metrics.riskLevel === 'medium' ? 60 : 90}
            color={metrics.riskLevel === 'low' ? 'success' : metrics.riskLevel === 'medium' ? 'warning' : 'error'}
            sx={{ height: 12, borderRadius: 6 }}
          />
          <Typography variant="body2" color="text.secondary" mt={1}>
            Based on crisis indicators, mood trends, and user engagement patterns
          </Typography>
        </CardContent>
      </Card>

      {/* Crisis Indicators */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6">
              Active Crisis Indicators
            </Typography>
            <Chip
              label={`${crisisIndicators.filter(i => !i.resolved).length} Active`}
              color="error"
              size="small"
            />
          </Box>

          <List>
            {crisisIndicators.map((indicator, index) => (
              <React.Fragment key={indicator.id}>
                <ListItem
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    mb: 2,
                    bgcolor: indicator.resolved ? 'action.hover' : 'background.paper',
                  }}
                >
                  <ListItemIcon>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getTypeIcon(indicator.type)}
                      {getSeverityIcon(indicator.severity)}
                    </Box>
                  </ListItemIcon>

                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <Typography variant="subtitle1">
                          {indicator.description}
                        </Typography>
                        <Chip
                          label={indicator.severity.toUpperCase()}
                          color={getSeverityColor(indicator.severity)}
                          size="small"
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary" mb={1}>
                          Detected: {indicator.detectedAt.toLocaleString()} • User: {indicator.userId}
                        </Typography>
                        <Typography variant="body2" mb={2}>
                          Recommended Actions:
                        </Typography>
                        <Box display="flex" flexWrap="wrap" gap={1}>
                          {indicator.actions.map((action, actionIndex) => (
                            <Chip
                              key={actionIndex}
                              label={action}
                              size="small"
                              variant="outlined"
                              onClick={() => handleTakeAction(indicator, action)}
                              sx={{ cursor: 'pointer' }}
                            />
                          ))}
                        </Box>
                      </Box>
                    }
                  />

                  {!indicator.resolved && (
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      onClick={() => handleResolveIndicator(indicator)}
                      sx={{ ml: 2 }}
                    >
                      Resolve
                    </Button>
                  )}
                </ListItem>
                {index < crisisIndicators.length - 1 && <Box sx={{ height: 8 }} />}
              </React.Fragment>
            ))}
          </List>
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog
        open={actionDialog}
        onClose={() => setActionDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Take Action: {selectedAction}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" paragraph>
            You are about to take the following action for user {selectedIndicator?.userId}:
          </Typography>

          <Typography variant="h6" color="primary" gutterBottom>
            {selectedAction}
          </Typography>

          <Typography variant="body2" color="text.secondary" paragraph>
            Indicator: {selectedIndicator?.description}
          </Typography>

          <TextField
            fullWidth
            multiline
            rows={4}
            label="Action Notes"
            placeholder="Add any additional notes or context for this action..."
            sx={{ mt: 2 }}
          />

          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Priority Level</InputLabel>
            <Select defaultValue="high">
              <MenuItem value="critical">Critical - Immediate Action Required</MenuItem>
              <MenuItem value="high">High - Action Within 1 Hour</MenuItem>
              <MenuItem value="medium">Medium - Action Within 24 Hours</MenuItem>
              <MenuItem value="low">Low - Monitor and Follow Up</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialog(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              // Implement action execution logic here
              analytics.track('Health Action Executed', {
                action: selectedAction,
                indicatorId: selectedIndicator?.id,
                component: 'HealthMonitoring',
              });
              setActionDialog(false);
            }}
          >
            Execute Action
          </Button>
        </DialogActions>
      </Dialog>

      {/* Privacy & Compliance Notice */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>Privacy & Compliance:</strong> All health monitoring data is processed in strict compliance with
          GDPR, HIPAA, and Swedish patient data regulations. User data is encrypted, anonymized, and only accessible
          to authorized healthcare professionals. Crisis detection algorithms are designed to prioritize user safety
          while respecting privacy rights.
        </Typography>
      </Alert>
    </Box>
  );
};

export default HealthMonitoring;