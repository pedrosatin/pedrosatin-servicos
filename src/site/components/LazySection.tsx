import { Component, Suspense, type ReactNode } from 'react';

/** A falha de um chunk afeta só a seção que depende dele. */
export class LazySection extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? null : <Suspense fallback={null}>{this.props.children}</Suspense>;
  }
}
