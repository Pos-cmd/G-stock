// Linter des figures comark-ui : le site sert /captures/… depuis public/.
import { defineConfig } from "comark-linter";

export default defineConfig({
  links: { routes: { "/": "public" } },
});
