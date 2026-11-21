interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleOAuth2CodeResponse {
  code?: string;
  error?: string;
}

interface GoogleOAuth2CodeClient {
  requestCode: () => void;
}

interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void | Promise<void>;
      }) => void;
      renderButton: (parent: HTMLElement, options: {
        type?: 'standard' | 'icon';
        theme?: 'outline' | 'filled_blue' | 'filled_black';
        size?: 'large' | 'medium' | 'small';
        text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
        shape?: 'rectangular' | 'pill' | 'circle' | 'square';
        width?: number;
      }) => void;
    };
    oauth2: {
      initCodeClient: (options: {
        client_id: string;
        scope: string;
        ux_mode?: 'popup' | 'redirect';
        callback: (response: GoogleOAuth2CodeResponse) => void | Promise<void>;
      }) => GoogleOAuth2CodeClient;
    };
  };
}

interface Window {
  google?: GoogleIdentityServices;
}
