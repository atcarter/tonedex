import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import { GoogleLogin } from "@react-oauth/google";
import type { CredentialResponse } from "@react-oauth/google";
import { useAppContext } from "../hooks/useAppContext";

export function AuthButton() {
  const { currentUser, signIn, signOut } = useAppContext();

  if (currentUser) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Avatar
          src={currentUser.avatar_url}
          alt={currentUser.name}
          sx={{ width: 32, height: 32 }}
        />
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
