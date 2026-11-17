// The parts of Google Identity Services and the Google Picker the Drive import
// uses; both load from Google's own script tags, so there's no package to type them.
// Docs: developers.google.com/drive/picker/reference and
// developers.google.com/identity/oauth2/web/reference/js-reference

declare namespace google.accounts.oauth2 {
  type TokenResponse = { access_token: string; expires_in: number; error?: string; error_description?: string };
  type TokenClient = { requestAccessToken(overrides?: { prompt?: string }): void };
  function initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type: string; message?: string }) => void;
  }): TokenClient;
}

declare namespace google.picker {
  enum Action {
    PICKED = "picked",
    CANCEL = "cancel",
  }
  enum ViewId {
    DOCS_IMAGES = "docs-images",
  }
  enum DocsViewMode {
    GRID = "grid",
  }
  enum Feature {
    MULTISELECT_ENABLED = "multiselectEnabled",
    SUPPORT_DRIVES = "sdr",
  }
  type PickedDoc = { id: string; name: string; mimeType: string; sizeBytes?: number };
  type ResponseObject = { action: string; docs?: PickedDoc[] };

  class DocsView {
    constructor(viewId?: ViewId);
    setIncludeFolders(include: boolean): DocsView;
    setSelectFolderEnabled(enabled: boolean): DocsView;
    setMode(mode: DocsViewMode): DocsView;
    setEnableDrives(enabled: boolean): DocsView;
  }
  class Picker {
    setVisible(visible: boolean): Picker;
    dispose(): void;
  }
  class PickerBuilder {
    addView(view: DocsView): PickerBuilder;
    enableFeature(feature: Feature): PickerBuilder;
    setOAuthToken(token: string): PickerBuilder;
    setDeveloperKey(key: string): PickerBuilder;
    setAppId(appId: string): PickerBuilder;
    setTitle(title: string): PickerBuilder;
    setMaxItems(max: number): PickerBuilder;
    setCallback(callback: (data: ResponseObject) => void): PickerBuilder;
    build(): Picker;
  }
}

declare namespace gapi {
  function load(api: string, callback: () => void): void;
}
