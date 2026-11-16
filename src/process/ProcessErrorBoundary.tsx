import { Component } from 'react';
import type { ReactNode } from 'react';

import { localFallback } from '../shared/api';
import { StatusScreen } from '../screens/status/StatusScreen';

interface Props {
  children: ReactNode;
  onError: () => void;
  onRetry: () => void;
}

export class ProcessErrorBoundary extends Component<
  Props,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  private retry = () => {
    this.props.onRetry();
    this.setState({ failed: false });
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return <StatusScreen response={localFallback} activate={this.retry} />;
  }
}
