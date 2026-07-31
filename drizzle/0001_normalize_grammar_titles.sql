UPDATE songs
SET data = json_set(
  data,
  '$.grammar',
  json(
    (
      SELECT json_group_array(
        json(
          json_set(
            grammar.value,
            '$.pattern',
            CASE
              WHEN length(trim(coalesce(json_extract(grammar.value, '$.meaning'), ''))) > 0
                AND length(trim(json_extract(grammar.value, '$.pattern'))) >
                  length(trim(json_extract(grammar.value, '$.meaning')))
                AND substr(
                  trim(json_extract(grammar.value, '$.pattern')),
                  -length(trim(json_extract(grammar.value, '$.meaning')))
                ) = trim(json_extract(grammar.value, '$.meaning'))
              THEN rtrim(
                substr(
                  trim(json_extract(grammar.value, '$.pattern')),
                  1,
                  length(trim(json_extract(grammar.value, '$.pattern'))) -
                    length(trim(json_extract(grammar.value, '$.meaning')))
                ),
                ' ：:・·—–-'
              )
              ELSE json_extract(grammar.value, '$.pattern')
            END
          )
        )
      )
      FROM json_each(songs.data, '$.grammar') AS grammar
    )
  )
)
WHERE json_type(data, '$.grammar') = 'array'
  AND EXISTS (
    SELECT 1
    FROM json_each(songs.data, '$.grammar') AS grammar
    WHERE length(trim(coalesce(json_extract(grammar.value, '$.meaning'), ''))) > 0
      AND length(trim(json_extract(grammar.value, '$.pattern'))) >
        length(trim(json_extract(grammar.value, '$.meaning')))
      AND substr(
        trim(json_extract(grammar.value, '$.pattern')),
        -length(trim(json_extract(grammar.value, '$.meaning')))
      ) = trim(json_extract(grammar.value, '$.meaning'))
  );
