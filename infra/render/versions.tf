terraform {
  required_version = ">= 1.6.0"

  required_providers {
    render = {
      source  = "render-oss/render"
      version = "= 1.9.1"
    }
  }
}

# Credentials come only from the RENDER_API_KEY and RENDER_OWNER_ID
# environment variables; nothing is configured here on purpose.
provider "render" {}
