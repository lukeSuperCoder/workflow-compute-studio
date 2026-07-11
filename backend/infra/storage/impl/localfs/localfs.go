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

package localfs

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/coze-dev/coze-studio/backend/infra/storage"
)

type Storage struct {
	rootDir       string
	publicBaseURL string
}

func New(rootDir, publicBaseURL string) (*Storage, error) {
	if rootDir == "" {
		rootDir = "./storage"
	}

	absRoot, err := filepath.Abs(rootDir)
	if err != nil {
		return nil, err
	}

	if err = os.MkdirAll(absRoot, 0o755); err != nil {
		return nil, err
	}

	return &Storage{
		rootDir:       absRoot,
		publicBaseURL: strings.TrimRight(publicBaseURL, "/"),
	}, nil
}

func (s *Storage) PutObject(ctx context.Context, objectKey string, content []byte, opts ...storage.PutOptFn) error {
	return s.PutObjectWithReader(ctx, objectKey, bytes.NewReader(content), opts...)
}

func (s *Storage) PutObjectWithReader(_ context.Context, objectKey string, content io.Reader, _ ...storage.PutOptFn) error {
	target, err := s.pathForKey(objectKey)
	if err != nil {
		return err
	}

	if err = os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return err
	}

	tmp, err := os.CreateTemp(filepath.Dir(target), ".upload-*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer func() {
		_ = os.Remove(tmpName)
	}()

	if _, err = io.Copy(tmp, content); err != nil {
		_ = tmp.Close()
		return err
	}
	if err = tmp.Close(); err != nil {
		return err
	}

	return os.Rename(tmpName, target)
}

func (s *Storage) GetObject(_ context.Context, objectKey string) ([]byte, error) {
	target, err := s.pathForKey(objectKey)
	if err != nil {
		return nil, err
	}

	content, err := os.ReadFile(target)
	if os.IsNotExist(err) {
		return nil, storage.ErrObjectNotFound
	}
	return content, err
}

func (s *Storage) DeleteObject(_ context.Context, objectKey string) error {
	target, err := s.pathForKey(objectKey)
	if err != nil {
		return err
	}

	err = os.Remove(target)
	if os.IsNotExist(err) {
		return storage.ErrObjectNotFound
	}
	return err
}

func (s *Storage) GetObjectUrl(_ context.Context, objectKey string, _ ...storage.GetOptFn) (string, error) {
	key, err := s.cleanKey(objectKey)
	if err != nil {
		return "", err
	}

	escaped := (&url.URL{Path: "/assets/" + key}).EscapedPath()
	if s.publicBaseURL == "" {
		return escaped, nil
	}

	return s.publicBaseURL + escaped, nil
}

func (s *Storage) HeadObject(ctx context.Context, objectKey string, opts ...storage.GetOptFn) (*storage.FileInfo, error) {
	target, err := s.pathForKey(objectKey)
	if err != nil {
		return nil, err
	}

	stat, err := os.Stat(target)
	if os.IsNotExist(err) {
		return nil, storage.ErrObjectNotFound
	}
	if err != nil {
		return nil, err
	}

	info := &storage.FileInfo{
		Key:          objectKey,
		LastModified: stat.ModTime(),
		Size:         stat.Size(),
	}

	option := &storage.GetOption{}
	for _, opt := range opts {
		opt(option)
	}
	if option.WithURL {
		info.URL, err = s.GetObjectUrl(ctx, objectKey)
		if err != nil {
			return nil, err
		}
	}

	return info, nil
}

func (s *Storage) ListAllObjects(ctx context.Context, prefix string, opts ...storage.GetOptFn) ([]*storage.FileInfo, error) {
	out, err := s.ListObjectsPaginated(ctx, &storage.ListObjectsPaginatedInput{
		Prefix:   prefix,
		PageSize: 0,
	}, opts...)
	if err != nil {
		return nil, err
	}

	return out.Files, nil
}

func (s *Storage) ListObjectsPaginated(ctx context.Context, input *storage.ListObjectsPaginatedInput, opts ...storage.GetOptFn) (*storage.ListObjectsPaginatedOutput, error) {
	if input == nil {
		input = &storage.ListObjectsPaginatedInput{}
	}
	if _, err := s.cleanKey(input.Prefix); input.Prefix != "" && err != nil {
		return nil, err
	}

	var files []*storage.FileInfo
	err := filepath.WalkDir(s.rootDir, func(path string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			return nil
		}

		rel, err := filepath.Rel(s.rootDir, path)
		if err != nil {
			return err
		}
		key := filepath.ToSlash(rel)
		if input.Prefix != "" && !strings.HasPrefix(key, input.Prefix) {
			return nil
		}

		info, err := s.HeadObject(ctx, key, opts...)
		if err != nil {
			return err
		}
		files = append(files, info)
		return nil
	})
	if err != nil {
		return nil, err
	}

	sort.Slice(files, func(i, j int) bool {
		return files[i].Key < files[j].Key
	})

	start := 0
	if input.Cursor != "" {
		for i, f := range files {
			if f.Key > input.Cursor {
				start = i
				break
			}
			start = len(files)
		}
	}

	end := len(files)
	if input.PageSize > 0 && start+input.PageSize < end {
		end = start + input.PageSize
	}

	var cursor string
	if end < len(files) && end > start {
		cursor = files[end-1].Key
	}

	return &storage.ListObjectsPaginatedOutput{
		Files:       files[start:end],
		Cursor:      cursor,
		IsTruncated: end < len(files),
	}, nil
}

func (s *Storage) pathForKey(objectKey string) (string, error) {
	key, err := s.cleanKey(objectKey)
	if err != nil {
		return "", err
	}

	target := filepath.Join(s.rootDir, filepath.FromSlash(key))
	if !s.isWithinRoot(target) {
		return "", fmt.Errorf("object key escapes storage root: %s", objectKey)
	}
	if err = s.ensureSymlinkSafe(target); err != nil {
		return "", err
	}

	return target, nil
}

func (s *Storage) isWithinRoot(path string) bool {
	rel, err := filepath.Rel(s.rootDir, path)
	if err != nil {
		return false
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

func (s *Storage) ensureSymlinkSafe(target string) error {
	root, err := filepath.EvalSymlinks(s.rootDir)
	if err != nil {
		return err
	}

	checkPath := target
	if _, err = os.Lstat(checkPath); err != nil {
		if !os.IsNotExist(err) {
			return err
		}
		checkPath = filepath.Dir(checkPath)
		for {
			if _, err = os.Lstat(checkPath); err == nil {
				break
			}
			if !os.IsNotExist(err) {
				return err
			}
			next := filepath.Dir(checkPath)
			if next == checkPath {
				return err
			}
			checkPath = next
		}
	}

	resolved, err := filepath.EvalSymlinks(checkPath)
	if err != nil {
		return err
	}
	rel, err := filepath.Rel(root, resolved)
	if err != nil {
		return err
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return fmt.Errorf("object key resolves outside storage root: %s", target)
	}

	return nil
}

func (s *Storage) cleanKey(objectKey string) (string, error) {
	if objectKey == "" {
		return "", fmt.Errorf("object key is empty")
	}
	if filepath.IsAbs(objectKey) {
		return "", fmt.Errorf("absolute object key is not allowed: %s", objectKey)
	}

	key := filepath.ToSlash(filepath.Clean(objectKey))
	if key == "." || strings.HasPrefix(key, "../") || key == ".." || strings.Contains(key, "/../") {
		return "", fmt.Errorf("invalid object key: %s", objectKey)
	}

	return strings.TrimLeft(key, "/"), nil
}

var _ storage.Storage = (*Storage)(nil)
