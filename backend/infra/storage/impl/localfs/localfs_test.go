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
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestStoragePutAndGetObject(t *testing.T) {
	ctx := context.Background()
	st, err := New(t.TempDir(), "")
	if err != nil {
		t.Fatal(err)
	}

	if err = st.PutObject(ctx, "uploads/10001/2026-07/file.txt", []byte("hello")); err != nil {
		t.Fatal(err)
	}

	got, err := st.GetObject(ctx, "uploads/10001/2026-07/file.txt")
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "hello" {
		t.Fatalf("unexpected object content: %q", got)
	}
}

func TestStorageRejectsPathTraversal(t *testing.T) {
	ctx := context.Background()
	st, err := New(t.TempDir(), "")
	if err != nil {
		t.Fatal(err)
	}

	if err = st.PutObject(ctx, "../escape.txt", []byte("nope")); err == nil {
		t.Fatal("expected path traversal to be rejected")
	}
}

func TestStorageRejectsParentSymlinkEscape(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	outside := t.TempDir()
	st, err := New(root, "")
	if err != nil {
		t.Fatal(err)
	}

	if err = os.Symlink(outside, filepath.Join(root, "uploads")); err != nil {
		t.Skipf("symlink not supported: %v", err)
	}

	if err = st.PutObject(ctx, "uploads/10001/file.txt", []byte("nope")); err == nil {
		t.Fatal("expected parent symlink escape to be rejected")
	}
}

func TestStorageRejectsFileSymlinkEscape(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	outside := filepath.Join(t.TempDir(), "secret.txt")
	if err := os.WriteFile(outside, []byte("secret"), 0o644); err != nil {
		t.Fatal(err)
	}

	st, err := New(root, "")
	if err != nil {
		t.Fatal(err)
	}
	if err = os.MkdirAll(filepath.Join(root, "uploads", "10001"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err = os.Symlink(outside, filepath.Join(root, "uploads", "10001", "secret.txt")); err != nil {
		t.Skipf("symlink not supported: %v", err)
	}

	if _, err = st.GetObject(ctx, "uploads/10001/secret.txt"); err == nil {
		t.Fatal("expected file symlink escape to be rejected")
	}
}
func TestStorageDeleteObject(t *testing.T) {
	ctx := context.Background()
	st, err := New(t.TempDir(), "")
	if err != nil {
		t.Fatal(err)
	}

	if err = st.PutObject(ctx, "uploads/10001/2026-07/file.txt", []byte("hello")); err != nil {
		t.Fatal(err)
	}

	if err = st.DeleteObject(ctx, "uploads/10001/2026-07/file.txt"); err != nil {
		t.Fatalf("delete failed: %v", err)
	}

	if _, err = st.GetObject(ctx, "uploads/10001/2026-07/file.txt"); err == nil {
		t.Fatal("expected object to be gone after delete")
	}

	if err = st.DeleteObject(ctx, "uploads/10001/2026-07/file.txt"); err == nil {
		t.Fatal("expected error when deleting non-existent object")
	}
}
