"use client";

interface AuthStatusProps {
  authenticated: boolean;
  onLogout: () => void;
}

export default function AuthStatus({ authenticated, onLogout }: AuthStatusProps) {
  if (authenticated) {
    return (
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-sm text-green-600">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Connected to X
        </span>
        <button
          onClick={onLogout}
          className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 border border-red-200 rounded-lg hover:bg-red-50"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <a
      href="/api/auth/login"
      className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
    >
      Login with X
    </a>
  );
}
