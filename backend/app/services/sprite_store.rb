# Mirrors PokeAPI sprite PNGs into public/sprites so browsers load them from
# us instead of raw.githubusercontent.com, which throttles request bursts
# (fast scrolling / whole-dex filtering rendered broken images).
#
# The files are committed to git: Heroku dyno filesystems are ephemeral and
# per-dyno, so the mirror must ship inside the slug — anything downloaded at
# runtime disappears on restart and never reaches the web dyno. Serialization
# falls back to the original PokeAPI URL whenever a file isn't mirrored yet.
#
# (This intentionally fetches from PokeAPI's sprite CDN, not the REST API —
# the PokeapiAdapter-only rule covers API calls and database writes.)
module SpriteStore
  OPEN_TIMEOUT = 2
  READ_TIMEOUT = 5

  module_function

  # Overridable seam for specs
  def public_root
    Rails.public_path
  end

  def relative_path(pokeapi_id, shiny: false)
    shiny ? "sprites/shiny/#{pokeapi_id}.png" : "sprites/#{pokeapi_id}.png"
  end

  def file_path(pokeapi_id, shiny: false)
    public_root.join(relative_path(pokeapi_id, shiny: shiny))
  end

  def mirrored?(pokeapi_id, shiny: false)
    File.exist?(file_path(pokeapi_id, shiny: shiny))
  end

  # The URL the API should serve: the mirrored copy when it exists (absolute,
  # rooted at base_url — the API origin serving public/), otherwise the
  # original upstream URL untouched.
  def url_for(pokemon, base_url, shiny: false)
    original = shiny ? pokemon.shiny_sprite_url : pokemon.sprite_url
    return original if original.blank?
    return original unless base_url.present? && mirrored?(pokemon.pokeapi_id, shiny: shiny)

    "#{base_url.chomp("/")}/#{relative_path(pokemon.pokeapi_id, shiny: shiny)}"
  end

  # Download both sprites for a pokemon (skipping blanks and existing files).
  # Idempotent; returns the number of files newly written.
  def mirror!(pokemon)
    [[pokemon.sprite_url, false], [pokemon.shiny_sprite_url, true]].count do |url, shiny|
      next false if url.blank? || mirrored?(pokemon.pokeapi_id, shiny: shiny)

      download(url, file_path(pokemon.pokeapi_id, shiny: shiny))
    end
  end

  def download(url, dest)
    response = HTTParty.get(url, open_timeout: OPEN_TIMEOUT, read_timeout: READ_TIMEOUT)
    unless response.success?
      Rails.logger.warn("[SpriteStore] #{response.code} for #{url}")
      return false
    end

    FileUtils.mkdir_p(dest.dirname)
    # Write-then-rename so a crash mid-download never leaves a truncated file
    tmp = "#{dest}.tmp"
    File.binwrite(tmp, response.body)
    File.rename(tmp, dest)
    true
  rescue Net::OpenTimeout, Net::ReadTimeout, Errno::ECONNRESET, Errno::ECONNREFUSED, SocketError => e
    Rails.logger.warn("[SpriteStore] failed for #{url}: #{e.message}")
    false
  end
end
