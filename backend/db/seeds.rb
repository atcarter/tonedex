# Seed popular Pokemon games from PokeAPI

POPULAR_GAMES = %w[
  red
  blue
  yellow
  gold
  silver
  crystal
  ruby
  sapphire
  emerald
  firered
  leafgreen
  diamond
  pearl
  platinum
  heartgold
  soulsilver
  black
  white
  black-2
  white-2
  x
  y
  omega-ruby
  alpha-sapphire
  sun
  moon
  ultra-sun
  ultra-moon
  sword
  shield
  brilliant-diamond
  shining-pearl
  legends-arceus
  scarlet
  violet
  legends-za
].freeze

puts "Seeding games..."

adapter = PokeapiAdapter.new

POPULAR_GAMES.each do |game_name|
  print "  #{game_name}..."
  begin
    adapter.find_or_create_game(game_name)
    puts " done"
  rescue PokeapiClient::ApiError => e
    puts " skipped (#{e.message})"
  end
end

puts "Seeded #{Game.count} games"
