package websocket

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	ws "github.com/gorilla/websocket"
	"github.com/growvest/stock-screener/pkg/logger"
)

var upgrader = ws.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type ScanProgress struct {
	ScanID          string `json:"scan_id"`
	Status          string `json:"status"`
	TotalStocks     int    `json:"total_stocks"`
	ProcessedStocks int    `json:"processed_stocks"`
	SuccessfulStocks int   `json:"successful_stocks"`
	FailedStocks    int    `json:"failed_stocks"`
	ResultsCount    int    `json:"results_count"`
	ExecutionTimeMs int    `json:"execution_time_ms"`
}

type Message struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

type client struct {
	conn   *ws.Conn
	send   chan []byte
	scanID string
}

type Hub struct {
	mu      sync.RWMutex
	clients map[*client]bool
	logger  *logger.Logger
}

func NewHub(log *logger.Logger) *Hub {
	return &Hub{
		clients: make(map[*client]bool),
		logger:  log.WithComponent("websocket_hub"),
	}
}

func (h *Hub) HandleConnection(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		h.logger.Error().Err(err).Msg("WebSocket upgrade failed")
		return
	}

	scanID := c.Query("scan_id")
	cl := &client{
		conn:   conn,
		send:   make(chan []byte, 256),
		scanID: scanID,
	}

	h.mu.Lock()
	h.clients[cl] = true
	h.mu.Unlock()

	go h.writePump(cl)
	go h.readPump(cl)
}

func (h *Hub) BroadcastScanProgress(progress *ScanProgress) {
	msg := Message{Type: "scan_progress", Payload: progress}
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for cl := range h.clients {
		if cl.scanID == "" || cl.scanID == progress.ScanID {
			select {
			case cl.send <- data:
			default:
				go h.removeClient(cl)
			}
		}
	}
}

func (h *Hub) removeClient(cl *client) {
	h.mu.Lock()
	if _, ok := h.clients[cl]; ok {
		delete(h.clients, cl)
		close(cl.send)
	}
	h.mu.Unlock()
	cl.conn.Close()
}

func (h *Hub) writePump(cl *client) {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		cl.conn.Close()
	}()

	for {
		select {
		case message, ok := <-cl.send:
			cl.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				cl.conn.WriteMessage(ws.CloseMessage, []byte{})
				return
			}
			if err := cl.conn.WriteMessage(ws.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			cl.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := cl.conn.WriteMessage(ws.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (h *Hub) readPump(cl *client) {
	defer h.removeClient(cl)

	cl.conn.SetReadLimit(512)
	cl.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	cl.conn.SetPongHandler(func(string) error {
		cl.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, _, err := cl.conn.ReadMessage()
		if err != nil {
			break
		}
	}
}
