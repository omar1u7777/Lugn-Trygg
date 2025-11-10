/**
 * Enhanced Error Boundary - Lugn & Trygg Design System
 * WCAG 2.1 AA compliant error handling with accessibility features
 */

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { colors, spacing, shadows, borderRadius } from '@/theme/tokens';
import { Box, Typography, Link } from '@mui/material';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  retryCount: number;
}

class ErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Enhanced error tracking with analytics
    import('../services/analytics').then(({ analytics }) => {
      analytics.error(error, {
        component: 'ErrorBoundary',
        action: 'component_error',
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
    });

    // Log error to external service in production
    if (process.env.NODE_ENV === 'production') {
      // logErrorToService(error, errorInfo);
    }
  }

  handleRetry = () => {
    const { retryCount } = this.state;

    if (retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        retryCount: prevState.retryCount + 1
      }));
    } else {
      // Max retries reached, reload the page
      window.location.reload();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { retryCount, error, errorInfo } = this.state;
      const canRetry = retryCount < this.maxRetries;
      const showDetails = this.props.showDetails || process.env.NODE_ENV === 'development';

      return (
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: spacing.md,
            bgcolor: "grey.50",
          }}
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          <Card
            title="🚨 Något gick fel"
            sx={{
              maxWidth: "md",
              width: "100%",
            }}
            elevation={2}
          >
            <Box sx={{ textAlign: "center", display: "flex", flexDirection: "column", gap: spacing.md }}>
              <Typography color="text.secondary">
                Vi är ledsna, men något oväntat hände. Vårt team har fått information om felet.
              </Typography>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {canRetry ? (
                  <Button
                    onClick={this.handleRetry}
                    variant="contained"
                    fullWidth
                    aria-label={`Försök igen (${retryCount + 1}/${this.maxRetries + 1})`}
                  >
                    🔄 Försök igen {retryCount > 0 && `(${retryCount}/${this.maxRetries})`}
                  </Button>
                ) : (
                  <Button
                    onClick={this.handleReload}
                    variant="contained"
                    fullWidth
                    aria-label="Ladda om sidan"
                  >
                    🔄 Ladda om sidan
                  </Button>
                )}

                <Button
                  onClick={() => window.history.back()}
                  variant="outlined"
                  fullWidth
                  aria-label="Gå tillbaka"
                >
                  ← Gå tillbaka
                </Button>
              </Box>

              {showDetails && error && (
                <Box component="details" sx={{ mt: spacing.md, textAlign: "left" }}>
                  <Box
                    component="summary"
                    sx={{
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      fontWeight: "medium",
                      color: "text.secondary",
                      "&:hover": {
                        color: "text.primary",
                      },
                    }}
                  >
                    Tekniska detaljer (för utvecklare)
                  </Box>
                  <Box
                    sx={{
                      mt: spacing.sm,
                      p: 1.5,
                      bgcolor: "grey.100",
                      borderRadius: 1,
                      fontSize: "0.75rem",
                      fontFamily: "monospace",
                      overflowX: "auto",
                      maxHeight: "160px",
                    }}
                  >
                    <Typography
                      variant="caption"
                      fontWeight="semibold"
                      color="error.main"
                      display="block"
                      gutterBottom
                    >
                      Fel:
                    </Typography>
                    <Typography variant="caption" color="text.primary" display="block" sx={{ mb: 1.5 }}>
                      {error.toString()}
                    </Typography>
                    {errorInfo?.componentStack && (
                      <>
                        <Typography
                          variant="caption"
                          fontWeight="semibold"
                          color="error.main"
                          display="block"
                          gutterBottom
                        >
                          Komponent stack:
                        </Typography>
                        <Box
                          component="pre"
                          sx={{
                            color: "text.secondary",
                            whiteSpace: "pre-wrap",
                            m: 0,
                          }}
                        >
                          {errorInfo.componentStack}
                        </Box>
                      </>
                    )}
                  </Box>
                </Box>
              )}

              <Box sx={{ pt: 2, borderTop: spacing.sm, borderColor: "divider" }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Om problemet kvarstår, kontakta vår support:
                </Typography>
                <Link
                  href="mailto:support@lugntrygg.se"
                  underline="hover"
                  color="primary"
                  aria-label="Skicka e-post till support"
                >
                  📧 support@lugntrygg.se
                </Link>
              </Box>
            </Box>
          </Card>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;