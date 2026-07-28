import { Component, type ReactNode } from "react";

export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.stack || error.message };
  }

  componentDidCatch(error: Error, info: any) {
    console.error("React Error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, color: "#c00", fontFamily: "monospace" }}>
          <h2>页面渲染出错：</h2>
          <pre style={{ background: "#fee", padding: 16, borderRadius: 8, overflow: "auto", maxHeight: "80vh" }}>
            {this.state.error}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
