package handlers

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

func SwaggerSpec() gin.HandlerFunc {
	return func(c *gin.Context) {
		paths := []string{
			"docs/openapi.yaml",
			"./docs/openapi.yaml",
			"../docs/openapi.yaml",
		}
		for _, p := range paths {
			data, err := os.ReadFile(p)
			if err == nil {
				c.Data(http.StatusOK, "application/x-yaml", data)
				return
			}
		}
		c.JSON(http.StatusNotFound, gin.H{"error": "OpenAPI spec not found"})
	}
}

func SwaggerUI() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(swaggerHTML))
	}
}

const swaggerHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Growvest API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>body { margin: 0; } .topbar { display: none; }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/docs/openapi.yaml',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout"
    });
  </script>
</body>
</html>`
