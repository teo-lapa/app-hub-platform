// Servizio per gestire i menu del ristorante tramite Odoo
import { OdooClient, withOdooAuth } from '../client';
import { ODOO_MODELS } from '../config';

export interface OdooMenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  category_id: [number, string];
  image?: string;
  is_vegetarian?: boolean;
  is_vegan?: boolean;
  is_gluten_free?: boolean;
  is_spicy?: boolean;
  is_popular?: boolean;
  ingredients?: string;
  allergens?: string;
  calories?: number;
  active: boolean;
  sequence?: number;
}

export interface OdooMenuCategory {
  id: number;
  name: string;
  description: string;
  sequence?: number;
  active: boolean;
  parent_id?: [number, string];
}

export class OdooMenuService {
  // Ottieni tutte le categorie del menu
  static async getCategories(): Promise<OdooMenuCategory[]> {
    return withOdooAuth(async (client: OdooClient) => {
      const result = await client.searchRead(
        ODOO_MODELS.RESTAURANT_CATEGORY,
        [['active', '=', true]],
        ['id', 'name', 'description', 'sequence', 'parent_id'],
        { order: 'sequence ASC, name ASC' }
      );

      if (!result.success) {
        throw new Error(`Failed to fetch menu categories: ${result.error}`);
      }

      return result.data || [];
    });
  }

  // Ottieni tutti gli item del menu
  static async getMenuItems(categoryId?: number): Promise<OdooMenuItem[]> {
    return withOdooAuth(async (client: OdooClient) => {
      const domain = [['active', '=', true]];
      if (categoryId) {
        domain.push(['category_id', '=', String(categoryId)]);
      }

      const result = await client.searchRead(
        ODOO_MODELS.RESTAURANT_MENU,
        domain,
        [
          'id', 'name', 'description', 'price', 'category_id',
          'image', 'is_vegetarian', 'is_vegan', 'is_gluten_free',
          'is_spicy', 'is_popular', 'ingredients', 'allergens',
          'calories', 'sequence'
        ],
        { order: 'sequence ASC, name ASC' }
      );

      if (!result.success) {
        throw new Error(`Failed to fetch menu items: ${result.error}`);
      }

      return result.data || [];
    });
  }

  // Ottieni un singolo item del menu
  static async getMenuItem(id: number): Promise<OdooMenuItem | null> {
    return withOdooAuth(async (client: OdooClient) => {
      const result = await client.read(
        ODOO_MODELS.RESTAURANT_MENU,
        [id],
        [
          'id', 'name', 'description', 'price', 'category_id',
          'image', 'is_vegetarian', 'is_vegan', 'is_gluten_free',
          'is_spicy', 'is_popular', 'ingredients', 'allergens',
          'calories'
        ]
      );

      if (!result.success) {
        throw new Error(`Failed to fetch menu item: ${result.error}`);
      }

      return result.data?.[0] || null;
    });
  }

  // Crea un nuovo item del menu
  static async createMenuItem(data: Partial<OdooMenuItem>): Promise<number> {
    return withOdooAuth(async (client: OdooClient) => {
      const result = await client.create(ODOO_MODELS.RESTAURANT_MENU, {
        name: data.name,
        description: data.description,
        price: data.price,
        category_id: data.category_id?.[0],
        is_vegetarian: data.is_vegetarian || false,
        is_vegan: data.is_vegan || false,
        is_gluten_free: data.is_gluten_free || false,
        is_spicy: data.is_spicy || false,
        is_popular: data.is_popular || false,
        ingredients: data.ingredients,
        allergens: data.allergens,
        calories: data.calories,
        active: true,
        sequence: data.sequence || 10,
      });

      if (!result.success) {
        throw new Error(`Failed to create menu item: ${result.error}`);
      }

      return result.data;
    });
  }

  // Aggiorna un item del menu
  static async updateMenuItem(id: number, data: Partial<OdooMenuItem>): Promise<boolean> {
    return withOdooAuth(async (client: OdooClient) => {
      const updateData: Record<string, any> = {};

      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.price !== undefined) updateData.price = data.price;
      if (data.category_id !== undefined) updateData.category_id = data.category_id[0];
      if (data.is_vegetarian !== undefined) updateData.is_vegetarian = data.is_vegetarian;
      if (data.is_vegan !== undefined) updateData.is_vegan = data.is_vegan;
      if (data.is_gluten_free !== undefined) updateData.is_gluten_free = data.is_gluten_free;
      if (data.is_spicy !== undefined) updateData.is_spicy = data.is_spicy;
      if (data.is_popular !== undefined) updateData.is_popular = data.is_popular;
      if (data.ingredients !== undefined) updateData.ingredients = data.ingredients;
      if (data.allergens !== undefined) updateData.allergens = data.allergens;
      if (data.calories !== undefined) updateData.calories = data.calories;
      if (data.sequence !== undefined) updateData.sequence = data.sequence;

      const result = await client.write(ODOO_MODELS.RESTAURANT_MENU, [id], updateData);

      if (!result.success) {
        throw new Error(`Failed to update menu item: ${result.error}`);
      }

      return result.data;
    });
  }

  // Elimina un item del menu
  static async deleteMenuItem(id: number): Promise<boolean> {
    return withOdooAuth(async (client: OdooClient) => {
      // Invece di eliminare fisicamente, disattiviamo l'item
      const result = await client.write(
        ODOO_MODELS.RESTAURANT_MENU,
        [id],
        { active: false }
      );

      if (!result.success) {
        throw new Error(`Failed to deactivate menu item: ${result.error}`);
      }

      return result.data;
    });
  }

  // Cerca item del menu per nome o ingredienti
  static async searchMenuItems(query: string): Promise<OdooMenuItem[]> {
    return withOdooAuth(async (client: OdooClient) => {
      const domain = [
        ['active', '=', true],
        '|', '|',
        ['name', 'ilike', query],
        ['description', 'ilike', query],
        ['ingredients', 'ilike', query]
      ];

      const result = await client.searchRead(
        ODOO_MODELS.RESTAURANT_MENU,
        domain,
        [
          'id', 'name', 'description', 'price', 'category_id',
          'is_vegetarian', 'is_vegan', 'is_gluten_free',
          'is_spicy', 'is_popular'
        ],
        { order: 'name ASC' }
      );

      if (!result.success) {
        throw new Error(`Failed to search menu items: ${result.error}`);
      }

      return result.data || [];
    });
  }

  // Ottieni statistiche del menu
  static async getMenuStats(): Promise<{
    totalItems: number;
    totalCategories: number;
    popularItems: number;
    vegetarianItems: number;
    veganItems: number;
  }> {
    return withOdooAuth(async (client: OdooClient) => {
      const [
        totalItems,
        totalCategories,
        popularItems,
        vegetarianItems,
        veganItems
      ] = await Promise.all([
        client.searchCount(ODOO_MODELS.RESTAURANT_MENU, [['active', '=', true]]),
        client.searchCount(ODOO_MODELS.RESTAURANT_CATEGORY, [['active', '=', true]]),
        client.searchCount(ODOO_MODELS.RESTAURANT_MENU, [['active', '=', true], ['is_popular', '=', true]]),
        client.searchCount(ODOO_MODELS.RESTAURANT_MENU, [['active', '=', true], ['is_vegetarian', '=', true]]),
        client.searchCount(ODOO_MODELS.RESTAURANT_MENU, [['active', '=', true], ['is_vegan', '=', true]])
      ]);

      return {
        totalItems: totalItems.data || 0,
        totalCategories: totalCategories.data || 0,
        popularItems: popularItems.data || 0,
        vegetarianItems: vegetarianItems.data || 0,
        veganItems: veganItems.data || 0,
      };
    });
  }
}