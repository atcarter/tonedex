import styled from "styled-components";
import { Link } from "react-router-dom";
import CatchingPokemonIcon from "@mui/icons-material/CatchingPokemon";

const Wrapper = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
  padding: 0 24px;
`;

const BigIcon = styled(CatchingPokemonIcon)`
  font-size: 64px !important;
  color: ${({ theme }) => theme.palette.action.disabled} !important;
`;

const Title = styled.h1`
  font-size: 1.4rem;
  font-weight: 800;
  color: ${({ theme }) => theme.palette.text.primary};
  margin: 0;
`;

const Hint = styled.p`
  font-size: 0.9rem;
  color: ${({ theme }) => theme.palette.text.secondary};
  margin: 0;
`;

const HomeLink = styled(Link)`
  margin-top: 8px;
  font-size: 0.9rem;
  font-weight: 700;
  color: ${({ theme }) => theme.palette.primary.main};
`;

export function NotFoundPage() {
  return (
    <Wrapper>
      <BigIcon />
      <Title>Page not found</Title>
      <Hint>This route isn't in any dex we know of.</Hint>
      <HomeLink to="/">Back to ToneDex</HomeLink>
    </Wrapper>
  );
}
