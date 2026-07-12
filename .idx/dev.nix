# To learn more about how to use Nix to configure your environment
# see: https://firebase.google.com/docs/studio/customize-workspace
{pkgs}: {
  # Which nixpkgs channel to use.
  channel = "stable-24.11"; # or "unstable"
  # Use https://search.nixos.org/packages to find packages
  packages = [
    pkgs.nodejs_22
    pkgs.zulu
  ];
  # Sets environment variables in the workspace
  env = {
    # Local dev: app NEXT_PUBLIC_USE_EMULATOR=true ile emulator'a baglanir,
    # prod'da bu flag set edilmez, gercek Firebase backend'e gider.
    NEXT_PUBLIC_USE_EMULATOR = "true";
    # Firebase emulator project id (firebase.json'daki singleProjectMode ile eslesir)
    NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-app";
    # Genkit dev UI icin local ayar (genkit start ile)
    GENKIT_ENV = "dev";
  };
  # CourtControl AI: firebase.json olusturuldu, emulators artik aktif.
  # Onceki 'detect = false' sebebiyle prod backend kullaniyorduk —
  # lokalde rules + auth + firestore'u emulator'de test edebilmek icin aktif ettik.
  services.firebase.emulators = {
    detect = true;
    projectId = "demo-app";
    services = ["auth" "firestore"];
    # UI console: http://localhost:4000
    enableUi = true;
  };
  idx = {
    # Search for the extensions you want on https://open-vsx.org/ and use "publisher.id"
    extensions = [
      # "vscodevim.vim"
    ];
    workspace = {
      onCreate = {
        default.openFiles = [
          "src/app/page.tsx"
        ];
      };
    };
    # Enable previews and customize configuration
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["npm" "run" "dev" "--" "--port" "$PORT" "--hostname" "0.0.0.0"];
          manager = "web";
        };
      };
    };
  };
}
