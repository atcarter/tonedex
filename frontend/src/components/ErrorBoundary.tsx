import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import * as Sentry from "@sentry/react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
    // No-op in development — Sentry.init is enabled in PROD only
    Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <Box sx={{ p: 3 }}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 2,
              borderLeft: "4px solid",
              borderLeftColor: "error.main",
            }}
          >
            <Typography
              variant="h6"
              color="error"
              gutterBottom
              sx={{ fontWeight: 700 }}
            >
              Something went wrong
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
              {this.state.error?.message ?? "An unexpected error occurred."}
            </Typography>
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={this.handleReset}
            >
              Try again
            </Button>
          </Paper>
        </Box>
      );
    }
    return this.props.children;
  }
}
