/*
 * Copyright 2025 coze-dev Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package workflow

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"
	"github.com/google/uuid"

	"github.com/coze-dev/coze-studio/backend/application/base/ctxutil"
	"github.com/coze-dev/coze-studio/backend/infra/storage"
	"github.com/coze-dev/coze-studio/backend/pkg/lang/conv"
)

const defaultMaxUploadSize = 50 * 1024 * 1024

type FileHandler struct {
	storage storage.Storage
}

type uploadResponse struct {
	Key         string `json:"key"`
	URL         string `json:"url"`
	Name        string `json:"name"`
	Size        int64  `json:"size"`
	ContentType string `json:"content_type"`
}

func NewFileHandler(st storage.Storage) *FileHandler {
	return &FileHandler{storage: st}
}

func (h *FileHandler) GetPublicAsset(ctx context.Context, c *app.RequestContext) {
	h.writeObject(ctx, c, c.Param("path"))
}

func (h *FileHandler) GetPrivateFile(ctx context.Context, c *app.RequestContext) {
	key := strings.TrimPrefix(c.Param("path"), "/")
	uid := ctxutil.GetUIDFromCtx(ctx)
	if uid == nil {
		c.JSON(consts.StatusUnauthorized, map[string]string{"error": "session required"})
		return
	}
	if !isUserUploadKey(key, *uid) {
		c.JSON(consts.StatusForbidden, map[string]string{"error": "file access denied"})
		return
	}

	h.writeObject(ctx, c, key)
}

func (h *FileHandler) Upload(ctx context.Context, c *app.RequestContext) {
	uid := ctxutil.GetUIDFromCtx(ctx)
	if uid == nil {
		c.JSON(consts.StatusUnauthorized, map[string]string{"error": "session required"})
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(consts.StatusBadRequest, map[string]string{"error": "missing file field"})
		return
	}

	maxSize := conv.StrToInt64D(os.Getenv("MAX_UPLOAD_SIZE"), defaultMaxUploadSize)
	if fileHeader.Size > maxSize {
		c.JSON(consts.StatusRequestEntityTooLarge, map[string]string{"error": "file too large"})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(consts.StatusInternalServerError, map[string]string{"error": "open uploaded file failed"})
		return
	}
	defer file.Close()

	var buf bytes.Buffer
	written, err := io.Copy(&buf, io.LimitReader(file, maxSize+1))
	if err != nil {
		c.JSON(consts.StatusInternalServerError, map[string]string{"error": "read uploaded file failed"})
		return
	}
	if written > maxSize {
		c.JSON(consts.StatusRequestEntityTooLarge, map[string]string{"error": "file too large"})
		return
	}

	contentType := fileHeader.Header.Get("Content-Type")
	if contentType == "" {
		contentType = http.DetectContentType(buf.Bytes())
	}

	key := buildUploadKey(*uid, fileHeader.Filename)
	if err = h.storage.PutObject(ctx, key, buf.Bytes(), storage.WithContentType(contentType)); err != nil {
		c.JSON(consts.StatusInternalServerError, map[string]string{"error": "store uploaded file failed"})
		return
	}

	c.JSON(consts.StatusOK, uploadResponse{
		Key:         key,
		URL:         "/api/files/" + key,
		Name:        filepath.Base(fileHeader.Filename),
		Size:        written,
		ContentType: contentType,
	})
}

func (h *FileHandler) writeObject(ctx context.Context, c *app.RequestContext, rawKey string) {
	key := strings.TrimPrefix(rawKey, "/")
	content, err := h.storage.GetObject(ctx, key)
	if errors.Is(err, storage.ErrObjectNotFound) {
		c.JSON(consts.StatusNotFound, map[string]string{"error": "file not found"})
		return
	}
	if err != nil {
		c.JSON(consts.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	contentType := mime.TypeByExtension(filepath.Ext(key))
	if contentType == "" {
		contentType = http.DetectContentType(content)
	}

	c.SetStatusCode(consts.StatusOK)
	c.SetContentType(contentType)
	c.Response.Header.Set("Cache-Control", "public, max-age=300")
	c.Response.SetBody(content)
}

func buildUploadKey(uid int64, filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	return fmt.Sprintf("uploads/%d/%s/%s%s", uid, time.Now().Format("2006-01"), uuid.NewString(), ext)
}

func isUserUploadKey(key string, uid int64) bool {
	prefix := "uploads/" + strconv.FormatInt(uid, 10) + "/"
	return strings.HasPrefix(key, prefix)
}
