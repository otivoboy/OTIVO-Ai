# To learn more about how to use Nix to configure your environment
# see: https://developers.google.com/idx/guides/customize-idx-env
{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "stable-23.11"; # or "unstable"

  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.nodejs_20
    pkgs.git
    pkgs.firebase-tools
    pkgs.python3
  ];

  # Sets environment variables in the workspace
  env = {
    TERM = "xterm-256color";
  };

  idx = {
    # Search for the extensions you want on https://open-vsx.org/ and use "publisher.id"
    extensions = [
      "dsznajder.es7-react-js-snippets"
      "esbenp.prettier-vscode"
      "bradlc.vscode-tailwindcss"
    ];

    # Workspace lifecycle hooks
    onCreate = {
      # Example: install JS dependencies from NPM
      npm-install = "npm install";
    };

    # Enable previews
    previews = {
      enable = true;
      previews = {
        web = {
          # Example: run "npm run dev" with PORT set to IDX's expected value
          command = ["npm" "run" "dev" "--" "--port" "$PORT" "--host" "0.0.0.0"];
          manager = "web";
        };
      };
    };
  };
}
