-- PROPOSAL ONLY. M assigns a NEW migration number and validates on its isolated
-- database. No applied migration is edited. Never apply without reviewing the
-- guarded caller rewrites below against the actual installed function bodies.
CREATE OR REPLACE FUNCTION vocabulary_private.sitov_spoken_alignment_valid(p_text text, m jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $sitov$
DECLARE a jsonb:=m->'spokenAlignment'; d text[]; s text[]; g jsonb; t jsonb;
 ds integer:=0; de integer; ss integer:=0; se integer; i integer:=0; changed boolean:=false;
 before_words text[]; after_words text[]; parts text[]; h integer; minute integer;
 small text[]:=ARRAY['null','eins','zwei','drei','vier','fünf','sechs','sieben','acht','neun','zehn','elf','zwölf','dreizehn','vierzehn','fünfzehn','sechzehn','siebzehn','achtzehn','neunzehn'];
 tens text[]:=ARRAY['','','zwanzig','dreißig','vierzig','fünfzig']; hn text; mn text; expected text; suffix text; previous_end numeric:=0;
BEGIN
 IF jsonb_typeof(a) IS DISTINCT FROM 'object' OR a->'version' IS DISTINCT FROM '1'::jsonb
 OR jsonb_typeof(a->'displayText') IS DISTINCT FROM 'string' OR jsonb_typeof(a->'spokenText') IS DISTINCT FROM 'string'
 OR a->>'displayText' IS DISTINCT FROM vocabulary_private.sitov_normalize_audio_text(p_text)
 OR coalesce(a->>'spokenText','')='' OR a->>'spokenText' IS DISTINCT FROM vocabulary_private.sitov_normalize_audio_text(a->>'spokenText')
 OR jsonb_typeof(a->'groups') IS DISTINCT FROM 'array' OR jsonb_array_length(a->'groups') NOT BETWEEN 1 AND 1500 THEN RETURN false; END IF;
 d:=string_to_array(a->>'displayText',' ');s:=string_to_array(a->>'spokenText',' ');
 IF jsonb_typeof(m->'wordTimings') IS DISTINCT FROM 'array' OR jsonb_array_length(m->'wordTimings') NOT BETWEEN 1 AND 1500
 OR jsonb_array_length(m->'wordTimings')<>cardinality(s) THEN RETURN false; END IF;
 FOR t IN SELECT value FROM jsonb_array_elements(m->'wordTimings') LOOP
  i:=i+1;
  IF jsonb_typeof(t->'start') IS DISTINCT FROM 'number' OR jsonb_typeof(t->'end') IS DISTINCT FROM 'number'
  OR (t->>'start')::numeric<previous_end OR (t->>'end')::numeric<(t->>'start')::numeric OR (t->>'end')::numeric>1200
  OR (s[i]~'[[:alnum:]]' AND (t->>'end')::numeric<=(t->>'start')::numeric) THEN RETURN false; END IF;
  previous_end:=(t->>'end')::numeric;
 END LOOP;
 FOR g IN SELECT value FROM jsonb_array_elements(a->'groups') LOOP
  IF jsonb_typeof(g->'display') IS DISTINCT FROM 'array' OR jsonb_typeof(g->'spoken') IS DISTINCT FROM 'array'
  OR jsonb_array_length(g->'display')<>2 OR jsonb_array_length(g->'spoken')<>2 THEN RETURN false; END IF;
  FOR t IN SELECT value FROM jsonb_array_elements((g->'display')||(g->'spoken')) LOOP
   IF jsonb_typeof(t) IS DISTINCT FROM 'number' OR t::text::numeric<>floor(t::text::numeric) THEN RETURN false; END IF;
  END LOOP;
  de:=(g#>>'{display,1}')::integer;se:=(g#>>'{spoken,1}')::integer;
  IF (g#>>'{display,0}')::integer<>ds OR (g#>>'{spoken,0}')::integer<>ss OR de<=ds OR se<=ss OR de>cardinality(d) OR se>cardinality(s) THEN RETURN false; END IF;
  before_words:=d[ds+1:de];after_words:=s[ss+1:se];
  IF before_words IS DISTINCT FROM after_words THEN
   parts:=regexp_match(before_words[1],'^([01]?[0-9]|2[0-3]):([0-5][0-9])([.,!?;:]?)$');
   IF parts IS NULL OR cardinality(before_words)>2 OR (cardinality(before_words)=2 AND (parts[3]<>'' OR before_words[2]!~'^Uhr[.,!?;:]?$')) THEN RETURN false; END IF;
   h:=parts[1]::integer;minute:=parts[2]::integer;
   hn:=CASE WHEN h=1 THEN 'ein' WHEN h<20 THEN small[h+1] ELSE CASE WHEN h%10=0 THEN '' WHEN h%10=1 THEN 'einund' ELSE small[h%10+1]||'und' END||tens[h/10+1] END;
   mn:=CASE WHEN minute<20 THEN small[minute+1] ELSE CASE WHEN minute%10=0 THEN '' WHEN minute%10=1 THEN 'einund' ELSE small[minute%10+1]||'und' END||tens[minute/10+1] END;
   suffix:=CASE WHEN cardinality(before_words)=2 THEN substring(before_words[2] FROM 4) ELSE parts[3] END;
   expected:=hn||' Uhr'||CASE WHEN minute=0 THEN '' ELSE ' '||mn END||suffix;
   IF array_to_string(after_words,' ') IS DISTINCT FROM expected THEN RETURN false; END IF;
   changed:=true;
  END IF;
  ds:=de;ss:=se;
 END LOOP;
 RETURN changed AND ds=cardinality(d) AND ss=cardinality(s);
EXCEPTION WHEN others THEN RETURN false;
END $sitov$;
REVOKE ALL ON FUNCTION vocabulary_private.sitov_spoken_alignment_valid(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- Preserve installed model/profile/text/audio/address/approval gates verbatim.
-- A missing anchor ABORTS this proposal; M must inspect and adapt, never skip it.
DO $sitov_patch$
DECLARE sig text; body text; old text; replacement text;
BEGIN
 FOR sig,old,replacement IN SELECT * FROM (VALUES
 ('vocabulary_private.sitov_prepared_german_audio_url(text)',
  'timings := authored->''wordTimings'';',
  'IF authored ? ''spokenAlignment'' THEN IF NOT vocabulary_private.sitov_spoken_alignment_valid(p_text,authored) THEN RAISE EXCEPTION ''prepared_audio_required'' USING ERRCODE=''22023''; END IF; spoken:=authored#>>''{spokenAlignment,spokenText}''; END IF; timings := authored->''wordTimings'';'),
 ('path_private.sitov_revision_strict_audio(text)',
  'FOR token,idx IN SELECT v,n FROM unnest(string_to_array(vocabulary_private.sitov_normalize_audio_text(p_text),'' ''))',
  'IF authored ? ''spokenAlignment'' AND NOT vocabulary_private.sitov_spoken_alignment_valid(p_text,authored) THEN RAISE EXCEPTION ''prepared_audio_required'' USING ERRCODE=''22023''; END IF; FOR token,idx IN SELECT v,n FROM unnest(string_to_array(CASE WHEN authored ? ''spokenAlignment'' THEN authored#>>''{spokenAlignment,spokenText}'' ELSE vocabulary_private.sitov_normalize_audio_text(p_text) END,'' ''))'),
 ('sitov_pronunciation_private.reference_valid(text,text,sitov_pronunciation_private.pretest_approvals)',
  'spoken:=vocabulary_private.sitov_normalize_audio_text(p_text);timings:=metadata->''wordTimings'';',
  'IF metadata ? ''spokenAlignment'' THEN RETURN vocabulary_private.sitov_spoken_alignment_valid(p_text,metadata); END IF; spoken:=vocabulary_private.sitov_normalize_audio_text(p_text);timings:=metadata->''wordTimings'';'),
 ('sitov_pronunciation_private.public_audio_ready(uuid,text,jsonb)',
  'words:=string_to_array(spoken,'' '');i:=0;',
  'IF authored ? ''spokenAlignment'' AND NOT vocabulary_private.sitov_spoken_alignment_valid(spoken,authored) THEN RETURN false; END IF; words:=string_to_array(CASE WHEN authored ? ''spokenAlignment'' THEN authored#>>''{spokenAlignment,spokenText}'' ELSE spoken END,'' '');i:=0;')
 ) p(sig,old,replacement) LOOP
  body:=pg_get_functiondef(sig::regprocedure);
  IF strpos(body,old)=0 THEN RAISE EXCEPTION 'spoken_alignment_proposal_anchor_missing: %',sig; END IF;
  EXECUTE replace(body,old,replacement);
 END LOOP;
END $sitov_patch$;
