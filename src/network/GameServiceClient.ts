export type ServiceMessage = {
  type: string;
  [key: string]: unknown;
};

export class GameServiceClient {
  private socket: WebSocket | null = null;
  private listeners = new Set<(message: ServiceMessage) => void>();

  onMessage(listener: (message: ServiceMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  connect(url: string, timeoutMs = 10_000): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      this.socket = socket;
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        socket.close();
        reject(new Error("Connection timed out."));
      }, timeoutMs);

      socket.addEventListener("open", () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        resolve();
      }, { once: true });

      socket.addEventListener("error", () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        reject(new Error("Unable to connect to the game service."));
      });

      socket.addEventListener("message", (event) => {
        if (typeof event.data !== "string") return;
        try {
          const message = JSON.parse(event.data) as ServiceMessage;
          if (message && typeof message.type === "string") this.emit(message);
        } catch {
          this.emit({ type: "server.error", code: "invalid-server-message" });
        }
      });

      socket.addEventListener("close", () => {
        if (this.socket === socket) this.socket = null;
        this.emit({ type: "server.disconnected" });
      });
    });
  }

  send(message: Record<string, unknown>): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Game service is not connected.");
    }
    this.socket.send(JSON.stringify(message));
  }

  disconnect(): void {
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState < WebSocket.CLOSING) {
      socket.close(1000, "client-left");
    }
    this.listeners.clear();
  }

  private emit(message: ServiceMessage): void {
    for (const listener of this.listeners) listener(message);
  }
}
