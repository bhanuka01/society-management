import React from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 my-6 max-w-xl mx-auto rounded-[12px] bg-[#0f1011] border border-[#eb5757]/30 text-[#ffffff] space-y-4 shadow-2xl">
          <div className="flex items-center gap-2.5 text-[#eb5757] pb-2 border-b border-[#23252a]">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <h3 className="text-[15px] font-[510] tracking-tight">
              Section Encountered an Error
            </h3>
          </div>
          <p className="text-[12px] text-[#8a8f98] leading-relaxed">
            An unexpected error occurred while rendering this section. You can retry rendering or return to the main dashboard.
          </p>
          {this.state.error && (
            <pre className="p-3 rounded-[6px] bg-[#161718] border border-[#23252a] text-[11px] font-berkeley-mono text-[#eb5757] overflow-x-auto whitespace-pre-wrap break-all">
              {this.state.error.message || String(this.state.error)}
            </pre>
          )}
          <div className="flex items-center gap-2.5 pt-2">
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-[#e4f222] text-[#08090a] text-[12px] font-[510] hover:bg-[#d8e61e] transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry View</span>
            </button>
            <button
              onClick={() => {
                this.handleReset();
                if (this.props.onNavigate) {
                  this.props.onNavigate("dashboard");
                } else if (typeof window !== "undefined") {
                  window.location.reload();
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-[#161718] border border-[#23252a] text-[#d0d6e0] text-[12px] hover:bg-[#23252a] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
