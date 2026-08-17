/**
 * Mapping from our category taxonomy to OpenStreetMap tag selectors.
 *
 * Only categories a design agency can realistically sell to are listed; the
 * excluded taxonomy entries deliberately have no OSM selector so they are never
 * even fetched.
 */
export const OSM_SELECTORS: Record<string, string[]> = {
  dental_clinic: ['amenity=dentist', 'healthcare=dentist'],
  cosmetic_surgery: ['healthcare=cosmetic_surgery'],
  private_clinic: ['amenity=clinic', 'amenity=doctors', 'healthcare=clinic', 'healthcare=doctor'],
  law_firm: ['office=lawyer'],
  real_estate: ['office=estate_agent'],
  hotel: ['tourism=hotel', 'tourism=apartment', 'tourism=guest_house', 'tourism=hostel'],
  yacht_charter: ['shop=boat', 'amenity=boat_rental'],
  wedding_events: ['shop=wedding', 'amenity=events_venue', 'amenity=conference_centre'],
  private_education: [
    'amenity=language_school',
    'amenity=driving_school',
    'office=educational_institution',
    'amenity=college',
  ],
  physiotherapy: ['healthcare=physiotherapist'],
  veterinary: ['amenity=veterinary'],
  architecture: ['office=architect', 'shop=interior_decoration'],
  professional_services: [
    'office=accountant',
    'office=notary',
    'office=tax_advisor',
    'office=consulting',
    'office=financial',
  ],
  construction: ['craft=builder', 'office=construction_company'],
  home_services: ['craft=plumber', 'craft=electrician', 'craft=locksmith', 'craft=hvac', 'craft=carpenter'],
  car_dealer: ['shop=car', 'shop=car_repair', 'shop=tyres', 'shop=motorcycle'],
  jewellery: ['shop=jewelry', 'shop=watches'],
  optician: ['shop=optician', 'shop=hearing_aids'],
  fitness: ['leisure=fitness_centre', 'leisure=sports_centre'],
  spa_wellness: ['leisure=spa', 'shop=massage'],
  travel_agency: ['shop=travel_agency', 'office=travel_agent'],
  restaurant: ['amenity=restaurant'],
  beauty: ['shop=hairdresser', 'shop=beauty', 'shop=tattoo'],
  pharmacy: ['amenity=pharmacy'],
  pet_services: ['shop=pet'],
  retail: ['shop=clothes', 'shop=furniture', 'shop=florist', 'shop=books', 'shop=shoes'],
  cafe_bar: ['amenity=cafe', 'amenity=bar', 'amenity=pub', 'shop=bakery'],
  grocery: ['shop=supermarket', 'shop=convenience'],
};

/** Every selector, used when no specific query is given. */
export function allSelectors(): string[] {
  return [...new Set(Object.values(OSM_SELECTORS).flat())];
}

/** Resolves category keys to the OSM selectors worth fetching. */
export function selectorsForCategories(categoryKeys: string[]): string[] {
  const selectors = categoryKeys.flatMap((key) => OSM_SELECTORS[key] ?? []);
  return [...new Set(selectors)];
}
