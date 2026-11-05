import styled from "styled-components";

// Mythical Pokémon are mostly event-only (PokeAPI's is_mythical)
const Tag = styled.span`
  display: inline-block;
  padding: 0 5px;
  border: 1px solid ${({ theme }) => theme.palette.divider};
  border-radius: 999px;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 14px;
  color: ${({ theme }) => theme.palette.text.secondary};

  ${({ theme }) => theme.breakpoints.down("sm")} {
    line-height: 11px;
  }
`;

export function MythicalTag({ className }: { className?: string }) {
  return (
    <Tag className={className} title="Mythical: usually only from events">
      Mythical
    </Tag>
  );
}
