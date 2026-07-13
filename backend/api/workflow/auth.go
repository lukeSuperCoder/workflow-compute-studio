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
	"context"
	"errors"
	"net/mail"
	"os"
	"sort"
	"strconv"
	"strings"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"github.com/coze-dev/coze-studio/backend/application/base/ctxutil"
	userentity "github.com/coze-dev/coze-studio/backend/domain/user/entity"
	"github.com/coze-dev/coze-studio/backend/pkg/errorx"
	appconsts "github.com/coze-dev/coze-studio/backend/types/consts"
	"github.com/coze-dev/coze-studio/backend/types/errno"
)

const invalidCredentialsMessage = "Email or password is incorrect"

type AuthService interface {
	Login(context.Context, string, string) (*userentity.User, error)
	Logout(context.Context, int64) error
	GetUserInfo(context.Context, int64) (*userentity.User, error)
	GetUserSpaceList(context.Context, int64) ([]*userentity.Space, error)
}

type AuthHandler struct {
	service AuthService
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authUser struct {
	UserID    string `json:"user_id"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	SpaceID   string `json:"space_id"`
	SpaceName string `json:"space_name"`
}

type authResponse struct {
	Code int       `json:"code"`
	Data *authUser `json:"data,omitempty"`
	Msg  string    `json:"msg,omitempty"`
}

func NewAuthHandler(service AuthService) *AuthHandler {
	return &AuthHandler{service: service}
}

func (h *AuthHandler) Login(ctx context.Context, c *app.RequestContext) {
	var req loginRequest
	if err := c.BindAndValidate(&req); err != nil {
		c.JSON(consts.StatusBadRequest, authResponse{Code: consts.StatusBadRequest, Msg: "Invalid login request"})
		return
	}
	req.Email = strings.TrimSpace(req.Email)
	if req.Email == "" || req.Password == "" {
		c.JSON(consts.StatusBadRequest, authResponse{Code: consts.StatusBadRequest, Msg: "Email and password are required"})
		return
	}
	parsedEmail, err := mail.ParseAddress(req.Email)
	if err != nil || parsedEmail.Address != req.Email {
		c.JSON(consts.StatusBadRequest, authResponse{Code: consts.StatusBadRequest, Msg: "Invalid email address"})
		return
	}

	user, err := h.service.Login(ctx, req.Email, req.Password)
	if err != nil {
		if isInvalidCredentials(err) {
			c.JSON(consts.StatusUnauthorized, authResponse{Code: consts.StatusUnauthorized, Msg: invalidCredentialsMessage})
			return
		}
		c.JSON(consts.StatusInternalServerError, authResponse{Code: consts.StatusInternalServerError, Msg: "Unable to sign in"})
		return
	}
	if user == nil {
		c.JSON(consts.StatusInternalServerError, authResponse{Code: consts.StatusInternalServerError, Msg: "Unable to sign in"})
		return
	}

	data, err := h.authUser(ctx, user)
	if err != nil {
		_ = h.service.Logout(ctx, user.UserID)
		if errors.Is(err, errNoAccessibleSpace) {
			c.JSON(consts.StatusForbidden, authResponse{Code: consts.StatusForbidden, Msg: "No accessible workspace"})
			return
		}
		c.JSON(consts.StatusInternalServerError, authResponse{Code: consts.StatusInternalServerError, Msg: "Unable to sign in"})
		return
	}

	c.SetCookie(
		userentity.SessionKey,
		user.SessionKey,
		appconsts.SessionMaxAgeSecond,
		"/",
		"",
		protocol.CookieSameSiteLaxMode,
		os.Getenv("WORKFLOW_COOKIE_SECURE") == "1",
		true,
	)
	c.JSON(consts.StatusOK, authResponse{Code: 0, Data: data})
}

func (h *AuthHandler) Session(ctx context.Context, c *app.RequestContext) {
	uid := ctxutil.GetUIDFromCtx(ctx)
	if uid == nil {
		c.JSON(consts.StatusUnauthorized, authResponse{Code: consts.StatusUnauthorized, Msg: "Authentication required"})
		return
	}
	user, err := h.service.GetUserInfo(ctx, *uid)
	if err != nil {
		c.JSON(consts.StatusInternalServerError, authResponse{Code: consts.StatusInternalServerError, Msg: "Unable to restore session"})
		return
	}
	data, err := h.authUser(ctx, user)
	if err != nil {
		if errors.Is(err, errNoAccessibleSpace) {
			c.JSON(consts.StatusForbidden, authResponse{Code: consts.StatusForbidden, Msg: "No accessible workspace"})
			return
		}
		c.JSON(consts.StatusInternalServerError, authResponse{Code: consts.StatusInternalServerError, Msg: "Unable to restore session"})
		return
	}
	c.JSON(consts.StatusOK, authResponse{Code: 0, Data: data})
}

func (h *AuthHandler) Logout(ctx context.Context, c *app.RequestContext) {
	uid := ctxutil.GetUIDFromCtx(ctx)
	if uid == nil {
		c.JSON(consts.StatusUnauthorized, authResponse{Code: consts.StatusUnauthorized, Msg: "Authentication required"})
		return
	}
	if err := h.service.Logout(ctx, *uid); err != nil {
		c.JSON(consts.StatusInternalServerError, authResponse{Code: consts.StatusInternalServerError, Msg: "Unable to sign out"})
		return
	}

	cookie := userentity.SessionKey + "=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"
	if os.Getenv("WORKFLOW_COOKIE_SECURE") == "1" {
		cookie += "; Secure"
	}
	c.Response.Header.Set("Set-Cookie", cookie)
	c.JSON(consts.StatusOK, authResponse{Code: 0})
}

var errNoAccessibleSpace = errors.New("no accessible workspace")

func (h *AuthHandler) authUser(ctx context.Context, user *userentity.User) (*authUser, error) {
	spaces, err := h.service.GetUserSpaceList(ctx, user.UserID)
	if err != nil {
		return nil, err
	}
	if len(spaces) == 0 {
		return nil, errNoAccessibleSpace
	}
	sort.Slice(spaces, func(i, j int) bool { return spaces[i].ID < spaces[j].ID })
	space := spaces[0]
	return &authUser{
		UserID:    strconv.FormatInt(user.UserID, 10),
		Name:      user.Name,
		Email:     user.Email,
		SpaceID:   strconv.FormatInt(space.ID, 10),
		SpaceName: space.Name,
	}, nil
}

func isInvalidCredentials(err error) bool {
	var statusErr errorx.StatusError
	return errors.As(err, &statusErr) && statusErr.Code() == errno.ErrUserInfoInvalidateCode
}
