(() => {
  const DATA_URL =
    "https://cdn.jsdelivr.net/npm/countries-list-json@1.1.1/countries.json";

  const normalizeDial = (dial) => {
    if (!dial) {
      return "";
    }
    const digits = dial.replace(/[^0-9]/g, "");
    return digits ? `+${digits}` : "";
  };

  const getFlagEmoji = (code) => {
    if (!code || code.length !== 2) {
      return "";
    }
    const upper = code.toUpperCase();
    const first = upper.charCodeAt(0) - 65 + 127462;
    const second = upper.charCodeAt(1) - 65 + 127462;
    return String.fromCodePoint(first, second);
  };

  const parseDialCode = (dialCode) => {
    if (!dialCode) {
      return "";
    }
    const first = dialCode.split(",")[0].trim();
    return normalizeDial(first);
  };

  const fetchCountries = async () => {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error("countries_load_failed");
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  };

  const buildCountries = (items) => {
    const cleaned = items
      .map((item) => {
        const dialCode = parseDialCode(item.dial_code || item.dialCode || "");
        return {
          name: item.name || "",
          code: item.code || item.iso2 || "",
          dialCode,
          flag: item.flag || "",
        };
      })
      .filter((item) => item.name && item.code && item.dialCode);

    const filtered = cleaned.filter((item) => item.code !== "IL");
    const hasPalestine = filtered.some((item) => item.code === "PS");
    if (!hasPalestine) {
      filtered.push({
        name: "Palestine",
        code: "PS",
        dialCode: "+970",
        flag: "",
      });
    }

    return filtered
      .map((item) => ({
        ...item,
        flag: item.flag || getFlagEmoji(item.code),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const setDisplay = (picker, country) => {
    const flagEl = picker.querySelector(".country-flag");
    const codeText = picker.querySelector(".country-code-text");
    if (flagEl) {
      flagEl.textContent = country.flag || "";
    }
    if (codeText) {
      codeText.textContent = country.dialCode;
    }
  };

  const setupPicker = (picker, countries) => {
    const trigger = picker.querySelector(".country-trigger");
    const menu = picker.querySelector(".country-menu");
    const search = picker.querySelector(".country-search");
    const optionsEl = picker.querySelector(".country-options");
    const hiddenInput =
      picker.querySelector('input[type="hidden"]') ||
      (picker.dataset.targetInput
        ? document.getElementById(picker.dataset.targetInput)
        : null);
    const defaultCode = picker.dataset.defaultCode || "+966";

    if (!trigger || !menu || !search || !optionsEl || !hiddenInput) {
      return;
    }

    const options = countries.map((country) => {
      const option = document.createElement("div");
      option.className = "country-option";
      option.dataset.code = country.code;
      option.dataset.dial = country.dialCode;
      option.dataset.search = `${country.name} ${country.code} ${country.dialCode}`.toLowerCase();
      option.innerHTML = `<span class="country-flag">${country.flag}</span><span class="country-name">${country.name}</span><span class="country-dial">${country.dialCode}</span>`;
      option.addEventListener("click", () => {
        hiddenInput.value = country.dialCode;
        hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
        setDisplay(picker, country);
        menu.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
      });
      return option;
    });

    options.forEach((option) => optionsEl.appendChild(option));

    const initial =
      countries.find((item) => item.dialCode === hiddenInput.value) ||
      countries.find((item) => item.dialCode === defaultCode) ||
      countries[0];

    if (initial) {
      hiddenInput.value = initial.dialCode;
      setDisplay(picker, initial);
    }

    trigger.addEventListener("click", () => {
      const isOpen = menu.classList.toggle("open");
      trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (isOpen) {
        search.focus();
      }
    });

    search.addEventListener("input", () => {
      const query = search.value.trim().toLowerCase();
      options.forEach((option) => {
        const match = option.dataset.search.includes(query);
        option.style.display = match ? "flex" : "none";
      });
    });

    hiddenInput.addEventListener("change", () => {
      const selected = countries.find((item) => item.dialCode === hiddenInput.value);
      if (selected) {
        setDisplay(picker, selected);
      }
    });

    document.addEventListener("click", (event) => {
      if (!picker.contains(event.target)) {
        menu.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
      }
    });
  };

  const init = (countries) => {
    window.HIS_COUNTRIES = countries;
    document.dispatchEvent(new CustomEvent("his:countries-loaded"));
    document
      .querySelectorAll("[data-country-picker]")
      .forEach((picker) => setupPicker(picker, countries));
  };

  fetchCountries()
    .then((items) => init(buildCountries(items)))
    .catch(() => {
      const fallback = [
        { name: "Saudi Arabia", code: "SA", dialCode: "+966", flag: getFlagEmoji("SA") },
        { name: "Palestine", code: "PS", dialCode: "+970", flag: getFlagEmoji("PS") },
      ];
      init(fallback);
    });
})();
