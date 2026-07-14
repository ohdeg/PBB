export interface BrewRecipe {
  id: string;
  name: string;
  method: string;
  beans: string;
  dose: string;
  water: string;
  temperature: string;
  time: string;
  grind: string;
  notes: string;
}

export const BREW_RECIPES: BrewRecipe[] = [];
