class CreateApiCaches < ActiveRecord::Migration[8.1]
  def change
    create_table :api_caches do |t|
      t.string :endpoint
      t.jsonb :response_data
      t.datetime :fetched_at

      t.timestamps
    end
    add_index :api_caches, :endpoint
  end
end
