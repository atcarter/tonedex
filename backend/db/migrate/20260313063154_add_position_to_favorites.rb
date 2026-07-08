class AddPositionToFavorites < ActiveRecord::Migration[8.1]
  def change
    add_column :favorites, :position, :integer
    # Backfill existing rows with ascending positions per user
    reversible do |dir|
      dir.up do
        execute <<~SQL
          UPDATE favorites f
          SET position = sub.row_num
          FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) AS row_num
            FROM favorites
          ) sub
          WHERE f.id = sub.id
        SQL
      end
    end
    add_index :favorites, [:user_id, :position]
  end
end
