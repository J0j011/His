(() => {
  const STORAGE_KEY = "his_accounts";
  const ADMIN_KEY = "his_admin";
  const ADMIN_CODE = "jojo123";
  const CURRENT_USER_KEY = "his_current_user";
  const MAX_ACCOUNTS = 10;
  const API_BASE = window.HIS_API_BASE || "";

  const loadAccounts = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  };

  const saveAccounts = (accounts) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  };

  const normalize = (value) => value.trim();
  const normalizeKey = (value) => value.trim().toLowerCase();
  const imageKeyFor = (username) => `his_profile_image_${normalizeKey(username)}`;
  const normalizePhone = (value) => value.replace(/[^\d+]/g, "");
  const normalizePhoneKey = (value) => normalizePhone(value).replace(/^00/, "+");

  const getCurrentUser = () => {
    const username = localStorage.getItem(CURRENT_USER_KEY);
    return username ? username : "";
  };

  const setMessage = (element, message, isError) => {
    if (!element) {
      return;
    }

    element.textContent = message;
    element.style.color = isError ? "#b00020" : "#1b5e20";
  };

  const postJson = async (path, payload) => {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    let data = null;
    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }

    if (!response.ok) {
      const error = new Error((data && data.error) || "request_failed");
      error.detail = data;
      throw error;
    }

    return data;
  };

  const findInput = (ids) => {
    for (const id of ids) {
      const input = document.getElementById(id);
      if (input) {
        return input;
      }
    }
    return null;
  };

  const updateToggleButton = (button, input) => {
    if (!button || !input) {
      return;
    }

    const isHidden = input.type === "password";
    button.textContent = isHidden ? "Show" : "Hide";
  };

  const parsePhoneForSelect = (phoneValue, countryInput, inputEl) => {
    if (!phoneValue || !countryInput || !inputEl) {
      return;
    }

    const normalized = normalizePhoneKey(phoneValue);
    const available = Array.isArray(window.HIS_COUNTRIES)
      ? window.HIS_COUNTRIES.map((item) => item.dialCode)
      : [];
    const match = available
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .find((value) => normalized.startsWith(value));

    if (match) {
      countryInput.value = match;
      countryInput.dispatchEvent(new Event("change", { bubbles: true }));
      inputEl.value = normalized.slice(match.length);
      return;
    }

    inputEl.value = normalized;
  };

  const whenCountriesReady = (callback) => {
    if (Array.isArray(window.HIS_COUNTRIES) && window.HIS_COUNTRIES.length) {
      callback();
      return;
    }

    document.addEventListener("his:countries-loaded", () => callback(), { once: true });
  };

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("form[data-auth]");
    const profileForm = document.querySelector("form[data-profile]");
    const messageEl = document.getElementById("form-message");
    const profileMessageEl = document.getElementById("profile-message");
    const clearButton = document.getElementById("clear-accounts");
    const adminButton = document.getElementById("admin-unlock");
    const adminLogoutButton = document.getElementById("admin-logout");
    const params = new URLSearchParams(window.location.search);
    const hasAdminToken = params.get("admin") === ADMIN_CODE;
    const profileButton = document.getElementById("profile-button");
    const profileAvatar = document.getElementById("profile-avatar");
    const profileInitials = document.getElementById("profile-initials");
    const profileImageInput = document.getElementById("profile-image");
    const sendCodeButton = document.getElementById("send-code");
    const resendCodeButton = document.getElementById("resend-code");
    const toggleButtons = document.querySelectorAll("button[data-toggle='password']");

    if (clearButton) {
      const isAdmin = localStorage.getItem(ADMIN_KEY) === "true";
      clearButton.style.display = isAdmin ? "block" : "none";

      clearButton.addEventListener("click", () => {
        localStorage.removeItem(STORAGE_KEY);
        setMessage(messageEl || profileMessageEl, "All accounts cleared.", false);
      });
    }

    if (adminButton) {
      adminButton.style.display = hasAdminToken ? "block" : "none";

      adminButton.addEventListener("click", () => {
        const code = window.prompt("Enter admin passcode:");
        if (code === ADMIN_CODE) {
          localStorage.setItem(ADMIN_KEY, "true");
          if (clearButton) {
            clearButton.style.display = "block";
          }
          if (adminLogoutButton) {
            adminLogoutButton.style.display = "block";
          }
          setMessage(messageEl || profileMessageEl, "Admin mode enabled.", false);
          return;
        }

        setMessage(messageEl || profileMessageEl, "Incorrect passcode.", true);
      });
    }

    if (adminLogoutButton) {
      const isAdmin = localStorage.getItem(ADMIN_KEY) === "true";
      adminLogoutButton.style.display = isAdmin ? "block" : "none";

      adminLogoutButton.addEventListener("click", () => {
        localStorage.removeItem(ADMIN_KEY);
        if (clearButton) {
          clearButton.style.display = "none";
        }
        adminLogoutButton.style.display = "none";
        setMessage(messageEl || profileMessageEl, "Admin mode disabled.", false);
      });
    }

    if (profileButton) {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        profileButton.style.display = "none";
      } else {
        const imageKey = imageKeyFor(currentUser);
        const imageData = localStorage.getItem(imageKey);
        if (imageData && profileAvatar) {
          profileAvatar.src = imageData;
          profileAvatar.alt = `${currentUser} profile picture`;
          profileAvatar.style.display = "block";
          if (profileInitials) {
            profileInitials.style.display = "none";
          }
        } else if (profileInitials) {
          profileInitials.textContent = currentUser.slice(0, 1).toUpperCase();
        }
      }

      profileButton.addEventListener("click", () => {
        window.location.href = "profile.html";
      });
    }

    if (profileForm) {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        setMessage(profileMessageEl, "Please log in to view your profile.", true);
        profileForm.querySelectorAll("input, button").forEach((element) => {
          element.disabled = true;
        });
        return;
      }

      const accounts = loadAccounts();
      const account = accounts.find(
        (item) => normalizeKey(item.username) === normalizeKey(currentUser)
      );

      if (!account) {
        setMessage(profileMessageEl, "Account not found. Please log in again.", true);
        profileForm.querySelectorAll("input, button").forEach((element) => {
          element.disabled = true;
        });
        return;
      }

      const emailInput = document.getElementById("profile-email");
      const phoneInput = document.getElementById("profile-phone");
      const phoneCountrySelect = document.getElementById("profile-phone-country");
      const passwordInput = document.getElementById("profile-password");
      const codeInput = document.getElementById("verification-code");
      const hideResend = () => {
        if (resendCodeButton) {
          resendCodeButton.style.display = "none";
        }
      };
      const showResend = () => {
        if (resendCodeButton) {
          resendCodeButton.style.display = "inline-block";
        }
      };

      if (emailInput) {
        emailInput.value = account.email || "";
      }
      if (phoneInput) {
        whenCountriesReady(() => {
          parsePhoneForSelect(account.phone || "", phoneCountrySelect, phoneInput);
        });
      }

      const imageKey = imageKeyFor(currentUser);
      const imageData = localStorage.getItem(imageKey);
      if (imageData && profileAvatar) {
        profileAvatar.src = imageData;
        profileAvatar.alt = `${currentUser} profile picture`;
        profileAvatar.style.display = "block";
        if (profileInitials) {
          profileInitials.style.display = "none";
        }
      } else if (profileInitials) {
        profileInitials.textContent = currentUser.slice(0, 1).toUpperCase();
      }

      if (profileImageInput) {
        profileImageInput.addEventListener("change", () => {
          const file = profileImageInput.files && profileImageInput.files[0];
          if (!file) {
            return;
          }

          const reader = new FileReader();
          reader.onload = () => {
            const result = typeof reader.result === "string" ? reader.result : "";
            if (!result) {
              return;
            }
            localStorage.setItem(imageKey, result);
            if (profileAvatar) {
              profileAvatar.src = result;
              profileAvatar.style.display = "block";
            }
            if (profileInitials) {
              profileInitials.style.display = "none";
            }
            setMessage(profileMessageEl, "Profile photo updated.", false);
          };
          reader.readAsDataURL(file);
        });
      }

      const sendVerificationCode = async () => {
        const targetEmail = emailInput && emailInput.value ? emailInput.value : account.email;
        if (!targetEmail) {
          setMessage(profileMessageEl, "Enter an email first.", true);
          return false;
        }

        try {
          await postJson("/api/send-code", { email: targetEmail });
          setMessage(profileMessageEl, `Verification code sent to ${targetEmail}.`, false);
          showResend();
          return true;
        } catch (error) {
          setMessage(
            profileMessageEl,
            "Could not send verification code. Please try again later.",
            true
          );
          return false;
        }
      };

      if (sendCodeButton) {
        sendCodeButton.addEventListener("click", async () => {
          await sendVerificationCode();
        });
      }

      if (resendCodeButton) {
        hideResend();
        resendCodeButton.addEventListener("click", async () => {
          await sendVerificationCode();
        });
      }

      profileForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const updatedEmail = emailInput ? normalize(emailInput.value) : "";
        const rawPhone = phoneInput ? normalizePhone(phoneInput.value) : "";
        const phoneCountry = phoneCountrySelect ? phoneCountrySelect.value : "";
        const updatedPhone = rawPhone ? `${phoneCountry}${rawPhone}` : "";
        const updatedPassword = passwordInput ? normalize(passwordInput.value) : "";

        const hasChanges =
          normalizeKey(updatedEmail) !== normalizeKey(account.email || "") ||
          normalizeKey(updatedPhone) !== normalizeKey(account.phone || "") ||
          !!updatedPassword;

        if (!hasChanges) {
          setMessage(profileMessageEl, "No changes to save.", true);
          return;
        }

        const enteredCode = codeInput ? normalize(codeInput.value) : "";

        if (!enteredCode) {
          await sendVerificationCode();
          setMessage(
            profileMessageEl,
            "Verification required. Check the code and enter it to save.",
            true
          );
          return;
        }

        if (!updatedEmail) {
          setMessage(profileMessageEl, "Email is required.", true);
          return;
        }

        const duplicate = accounts.find(
          (item) =>
            normalizeKey(item.username) !== normalizeKey(account.username) &&
            (normalizeKey(item.email) === normalizeKey(updatedEmail) ||
              (updatedPhone &&
                normalizePhoneKey(item.phone || "") === normalizePhoneKey(updatedPhone)))
        );

        if (duplicate) {
          setMessage(profileMessageEl, "Email or phone already in use.", true);
          return;
        }

        try {
          await postJson("/api/verify-code", {
            email: updatedEmail,
            code: enteredCode,
          });
        } catch (error) {
          const detail = error.detail && error.detail.error ? error.detail.error : "invalid_code";
          if (detail === "code_expired") {
            setMessage(profileMessageEl, "Code expired. Click resend.", true);
          } else {
            setMessage(profileMessageEl, "Invalid code. Try again.", true);
          }
          return;
        }

        account.email = updatedEmail;
        account.phone = updatedPhone;
        if (updatedPassword) {
          account.password = updatedPassword;
        }

        saveAccounts(accounts);
        hideResend();
        if (codeInput) {
          codeInput.value = "";
        }
        if (passwordInput) {
          passwordInput.value = "";
        }

        setMessage(profileMessageEl, "Profile updated successfully.", false);
      });
    }

    if (!form) {
      return;
    }

    const mode = form.getAttribute("data-auth");

    if (mode === "signup") {
      form.addEventListener("submit", (event) => {
        event.preventDefault();

        const usernameInput = findInput(["signup-username", "username"]);
        const passwordInput = findInput(["signup-password", "password"]);
        const emailInput = findInput(["signup-email", "email"]);
        const phoneInput = findInput(["phone"]);
        const phoneCountrySelect = document.getElementById("phone-country");

        const username = usernameInput ? normalize(usernameInput.value) : "";
        const password = passwordInput ? normalize(passwordInput.value) : "";
        const email = emailInput ? normalize(emailInput.value) : "";
        const rawPhone = phoneInput ? normalizePhone(phoneInput.value) : "";
        const phoneCountry = phoneCountrySelect ? phoneCountrySelect.value : "";
        const phone = rawPhone ? `${phoneCountry}${rawPhone}` : "";

        if (!username || !password || !email) {
          setMessage(messageEl, "Please fill in username, password, and email.", true);
          return;
        }

        const accounts = loadAccounts();
        if (accounts.length >= MAX_ACCOUNTS) {
          setMessage(messageEl, "Account limit reached (10).", true);
          return;
        }

        const usernameKey = normalizeKey(username);
        const emailKey = normalizeKey(email);
        const phoneKey = phone ? normalizePhoneKey(phone) : "";
        const exists = accounts.some((account) => {
          if (
            normalizeKey(account.username) === usernameKey ||
            normalizeKey(account.email) === emailKey
          ) {
            return true;
          }
          if (phoneKey && normalizePhoneKey(account.phone || "") === phoneKey) {
            return true;
          }
          return false;
        });

        if (exists) {
          setMessage(messageEl, "Username or email already exists.", true);
          return;
        }

        accounts.push({
          username,
          password,
          email,
          phone,
        });

        saveAccounts(accounts);
        setMessage(messageEl, "Account created. You can log in now.", false);
        form.reset();

        const loginTarget = form.getAttribute("data-login-target");
        if (loginTarget) {
          setTimeout(() => {
            window.location.href = loginTarget;
          }, 800);
        }
      });
    }

    if (mode === "login") {
      form.addEventListener("submit", (event) => {
        event.preventDefault();

        const usernameInput = findInput(["login-username", "username"]);
        const passwordInput = findInput(["login-password", "password"]);

        const usernameOrEmail = usernameInput ? normalize(usernameInput.value) : "";
        const password = passwordInput ? normalize(passwordInput.value) : "";

        if (!usernameOrEmail || !password) {
          setMessage(messageEl, "Please enter your username or email and password.", true);
          return;
        }

        const accounts = loadAccounts();
        const lookupKey = normalizeKey(usernameOrEmail);
        const account = accounts.find(
          (item) =>
            normalizeKey(item.username) === lookupKey ||
            normalizeKey(item.email) === lookupKey ||
            normalizePhoneKey(item.phone || "") === normalizePhoneKey(usernameOrEmail) ||
            (normalizePhoneKey(usernameOrEmail) &&
              normalizePhoneKey(item.phone || "").endsWith(normalizePhoneKey(usernameOrEmail)))
        );

        if (!account) {
          setMessage(messageEl, "Don't have an account yet? Make one now.", true);
          return;
        }

        if (account.password !== password) {
          setMessage(messageEl, "Invalid password.", true);
          return;
        }

        setMessage(messageEl, "Login successful. Redirecting...", false);
        localStorage.setItem(CURRENT_USER_KEY, account.username);
        const successTarget = form.getAttribute("data-success-target");
        if (successTarget) {
          setTimeout(() => {
            window.location.href = successTarget;
          }, 500);
        }
      });
    }

    if (toggleButtons.length) {
      toggleButtons.forEach((button) => {
        const targetId = button.getAttribute("data-target");
        const input = targetId ? document.getElementById(targetId) : null;
        updateToggleButton(button, input);

        button.addEventListener("click", () => {
          if (!input) {
            return;
          }
          input.type = input.type === "password" ? "text" : "password";
          updateToggleButton(button, input);
        });
      });
    }
  });
})();
