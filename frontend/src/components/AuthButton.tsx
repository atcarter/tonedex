import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import { GoogleLogin } from "@react-oauth/google";
import type { CredentialResponse } from "@react-oauth/google";
import type { User } from "../types";
import { useAppContext } from "../hooks/useAppContext";

// The pieces below are shared with the phone header's account menu, which
// arranges them differently; AuthButton is the desktop toolbar layout.

export function UserAvatar({ user }: { user: User }) {
  return (
    <Avatar
      src={user.avatar_url}
      alt={user.name}
      sx={{ width: 32, height: 32 }}
    />
  );
}

export function GoogleSignIn() {
  const { signIn } = useAppContext();

  return (
    <GoogleLogin
      onSuccess={(res: CredentialResponse) => {
        if (res.credential) signIn(res.credential).catch(console.error);
      }}
      onError={() => console.error("Google sign-in failed")}
      size="small"
      theme="outline"
      shape="pill"
    />
  );
}

export function AuthButton() {
  const { currentUser, signOut } = useAppContext();

  if (currentUser) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <UserAvatar user={currentUser} />
        <Button
          size="small"
          onClick={signOut}
          sx={{
            color: "white",
            textTransform: "none",
            fontSize: "0.75rem",
            minWidth: 0,
          }}
        >
          Sign out
        </Button>
      </Box>
    );
  }

  return <GoogleSignIn />;
}
