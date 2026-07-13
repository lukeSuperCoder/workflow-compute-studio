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
	"encoding/json"
	"testing"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/common/config"
	"github.com/cloudwego/hertz/pkg/common/ut"
	"github.com/cloudwego/hertz/pkg/route"
	"github.com/stretchr/testify/require"

	userentity "github.com/coze-dev/coze-studio/backend/domain/user/entity"
	"github.com/coze-dev/coze-studio/backend/pkg/ctxcache"
	"github.com/coze-dev/coze-studio/backend/pkg/errorx"
	"github.com/coze-dev/coze-studio/backend/types/consts"
	"github.com/coze-dev/coze-studio/backend/types/errno"
)

type fakeAuthService struct {
	loginUser  *userentity.User
	loginErr   error
	infoUser   *userentity.User
	infoErr    error
	spaces     []*userentity.Space
	spacesErr  error
	logoutIDs  []int64
	logoutErr  error
	loginEmail string
}

func (f *fakeAuthService) Login(_ context.Context, email, _ string) (*userentity.User, error) {
	f.loginEmail = email
	return f.loginUser, f.loginErr
}

func (f *fakeAuthService) Logout(_ context.Context, userID int64) error {
	f.logoutIDs = append(f.logoutIDs, userID)
	return f.logoutErr
}

func (f *fakeAuthService) GetUserInfo(_ context.Context, _ int64) (*userentity.User, error) {
	return f.infoUser, f.infoErr
}

func (f *fakeAuthService) GetUserSpaceList(_ context.Context, _ int64) ([]*userentity.Space, error) {
	return f.spaces, f.spacesErr
}

func newAuthTestEngine() *route.Engine {
	return route.NewEngine(config.NewOptions(nil))
}

func decodeAuthBody(t *testing.T, body []byte) map[string]any {
	t.Helper()
	var payload map[string]any
	require.NoError(t, json.Unmarshal(body, &payload))
	return payload
}

func TestAuthLoginSetsCookieAndSelectsSmallestSpace(t *testing.T) {
	svc := &fakeAuthService{
		loginUser: &userentity.User{UserID: 42, Name: "Luke", Email: "luke@example.com", SessionKey: "signed-session"},
		spaces: []*userentity.Space{
			{ID: 9, Name: "Nine"},
			{ID: 3, Name: "Three"},
		},
	}
	handler := NewAuthHandler(svc)
	engine := newAuthTestEngine()
	engine.POST("/api/auth/login", handler.Login)
	body := []byte(`{"email":"luke@example.com","password":"secret"}`)

	recorder := ut.PerformRequest(engine, "POST", "/api/auth/login", &ut.Body{Body: bytes.NewReader(body), Len: len(body)},
		ut.Header{Key: "Content-Type", Value: "application/json"})
	resp := recorder.Result()

	require.Equal(t, 200, resp.StatusCode())
	require.Equal(t, "luke@example.com", svc.loginEmail)
	payload := decodeAuthBody(t, resp.Body())
	data := payload["data"].(map[string]any)
	require.Equal(t, "3", data["space_id"])
	require.Equal(t, "Three", data["space_name"])
	cookie := string(resp.Header.Peek("Set-Cookie"))
	require.Contains(t, cookie, "session_key=signed-session")
	require.Contains(t, cookie, "HttpOnly")
	require.Contains(t, cookie, "SameSite=Lax")
}

func TestAuthLoginRejectsInvalidCredentials(t *testing.T) {
	svc := &fakeAuthService{loginErr: errorx.New(errno.ErrUserInfoInvalidateCode)}
	handler := NewAuthHandler(svc)
	engine := newAuthTestEngine()
	engine.POST("/api/auth/login", handler.Login)
	body := []byte(`{"email":"missing@example.com","password":"wrong"}`)

	resp := ut.PerformRequest(engine, "POST", "/api/auth/login", &ut.Body{Body: bytes.NewReader(body), Len: len(body)},
		ut.Header{Key: "Content-Type", Value: "application/json"}).Result()

	require.Equal(t, 401, resp.StatusCode())
	require.Equal(t, "Email or password is incorrect", decodeAuthBody(t, resp.Body())["msg"])
}

func TestAuthLoginRejectsEmptyInput(t *testing.T) {
	handler := NewAuthHandler(&fakeAuthService{})
	engine := newAuthTestEngine()
	engine.POST("/api/auth/login", handler.Login)
	body := []byte(`{"email":"","password":""}`)

	resp := ut.PerformRequest(engine, "POST", "/api/auth/login", &ut.Body{Body: bytes.NewReader(body), Len: len(body)},
		ut.Header{Key: "Content-Type", Value: "application/json"}).Result()

	require.Equal(t, 400, resp.StatusCode())
}

func TestAuthLoginRejectsMalformedEmail(t *testing.T) {
	svc := &fakeAuthService{}
	handler := NewAuthHandler(svc)
	engine := newAuthTestEngine()
	engine.POST("/api/auth/login", handler.Login)
	body := []byte(`{"email":"not-an-email","password":"secret"}`)

	resp := ut.PerformRequest(engine, "POST", "/api/auth/login", &ut.Body{Body: bytes.NewReader(body), Len: len(body)},
		ut.Header{Key: "Content-Type", Value: "application/json"}).Result()

	require.Equal(t, 400, resp.StatusCode())
	require.Empty(t, svc.loginEmail)
}

func TestAuthLoginRejectsEmptyServiceResult(t *testing.T) {
	handler := NewAuthHandler(&fakeAuthService{})
	engine := newAuthTestEngine()
	engine.POST("/api/auth/login", handler.Login)
	body := []byte(`{"email":"luke@example.com","password":"secret"}`)

	resp := ut.PerformRequest(engine, "POST", "/api/auth/login", &ut.Body{Body: bytes.NewReader(body), Len: len(body)},
		ut.Header{Key: "Content-Type", Value: "application/json"}).Result()

	require.Equal(t, 500, resp.StatusCode())
}

func TestAuthLoginWithoutSpaceInvalidatesSession(t *testing.T) {
	svc := &fakeAuthService{
		loginUser: &userentity.User{UserID: 42, Name: "Luke", Email: "luke@example.com", SessionKey: "signed-session"},
	}
	handler := NewAuthHandler(svc)
	engine := newAuthTestEngine()
	engine.POST("/api/auth/login", handler.Login)
	body := []byte(`{"email":"luke@example.com","password":"secret"}`)

	resp := ut.PerformRequest(engine, "POST", "/api/auth/login", &ut.Body{Body: bytes.NewReader(body), Len: len(body)},
		ut.Header{Key: "Content-Type", Value: "application/json"}).Result()

	require.Equal(t, 403, resp.StatusCode())
	require.Equal(t, []int64{42}, svc.logoutIDs)
	require.Empty(t, resp.Header.Peek("Set-Cookie"))
}

func TestAuthSessionRestoresIdentity(t *testing.T) {
	svc := &fakeAuthService{
		infoUser: &userentity.User{UserID: 42, Name: "Luke", Email: "luke@example.com"},
		spaces:   []*userentity.Space{{ID: 3, Name: "Three"}},
	}
	handler := NewAuthHandler(svc)
	engine := newAuthTestEngine()
	engine.Use(func(c context.Context, ctx *app.RequestContext) {
		c = ctxcache.Init(c)
		ctxcache.Store(c, consts.SessionDataKeyInCtx, &userentity.Session{UserID: 42})
		ctx.Next(c)
	})
	engine.GET("/api/auth/session", handler.Session)

	resp := ut.PerformRequest(engine, "GET", "/api/auth/session", nil).Result()

	require.Equal(t, 200, resp.StatusCode())
	data := decodeAuthBody(t, resp.Body())["data"].(map[string]any)
	require.Equal(t, "42", data["user_id"])
	require.Equal(t, "3", data["space_id"])
}

func TestAuthLogoutExpiresCookie(t *testing.T) {
	svc := &fakeAuthService{}
	handler := NewAuthHandler(svc)
	engine := newAuthTestEngine()
	engine.Use(func(c context.Context, ctx *app.RequestContext) {
		c = ctxcache.Init(c)
		ctxcache.Store(c, consts.SessionDataKeyInCtx, &userentity.Session{UserID: 42})
		ctx.Next(c)
	})
	engine.POST("/api/auth/logout", handler.Logout)

	resp := ut.PerformRequest(engine, "POST", "/api/auth/logout", nil).Result()

	require.Equal(t, 200, resp.StatusCode())
	require.Equal(t, []int64{42}, svc.logoutIDs)
	cookie := string(resp.Header.Peek("Set-Cookie"))
	require.Contains(t, cookie, "session_key=")
	require.Contains(t, cookie, "Max-Age=0")
}
