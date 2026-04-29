const fs = require('fs');
let data = JSON.parse(fs.readFileSync('distillation_notebook.ipynb', 'utf8'));

data.cells.forEach(c => {
    if (c.cell_type === 'code') {
        let sourceStr = c.source.join('');
        
        // Remove token login if it exists
        sourceStr = sourceStr.replace(/login\(token="YOUR_HF_TOKEN"\)/g, '# login(token="YOUR_HF_TOKEN")');
        
        // Check if this is the extraction cell
        if (sourceStr.includes('if len(rules) < TARGET_COUNT:') && sourceStr.includes('Extracting from HF Wikipedia dump')) {
            const replacement = `if len(rules) < TARGET_COUNT:
    print("🚀 Extracting from Wikipedia XML dump directly...")
    pbar = tqdm(total=TARGET_COUNT, initial=len(rules))
    writer = jsonlines.open(RULES_FILE, mode='a')
    
    import requests
    import bz2
    import xml.etree.ElementTree as ET
    
    url = "https://dumps.wikimedia.org/enwiki/latest/enwiki-latest-pages-articles.xml.bz2"
    
    # Stream the file and decompress on the fly
    response = requests.get(url, stream=True)
    decompressor = bz2.BZ2Decompressor()
    
    # Parse XML iteratively
    def get_texts():
        buffer = b""
        for chunk in response.iter_content(chunk_size=65536):
            if not chunk: break
            try:
                decompressed_chunk = decompressor.decompress(chunk)
                buffer += decompressed_chunk
            except EOFError:
                break
                
            # Yield full chunks roughly separated by tags
            while b"</text>" in buffer:
                start_match = buffer.find(b"<text")
                end_match = buffer.find(b"</text>") + 7
                if start_match != -1 and end_match != -1 and start_match < end_match:
                    xml_chunk = buffer[start_match:end_match]
                    try:
                        text_content = xml_chunk.split(b">", 1)[1].split(b"</text>")[0].decode('utf-8', errors='ignore')
                        yield text_content
                    except:
                        pass
                    buffer = buffer[end_match:]
                else:
                    # Clean up buffer if corrupted
                    if len(buffer) > 1000000:
                        buffer = buffer[-100000:]
                    break

    for text in get_texts():
        new_links = extract_causal_logic(text)
        
        for link in new_links:
            key = (link['cause'], link['effect'])
            if key not in seen_keys:
                seen_keys.add(key)
                rules.append(link)
                writer.write(link)
                pbar.update(1)

        if len(rules) >= TARGET_COUNT:
            break
            
    writer.close()
    print("\\n✅ Rules Secured with Direct Wikipedia Pipeline.")
else:
    print("✅ 5M Dataset already complete. Skipping extraction.")`;
            
            // Replace the entire block from `if len(rules) < TARGET_COUNT:` onwards
            let parts = sourceStr.split('if len(rules) < TARGET_COUNT:');
            sourceStr = parts[0] + replacement;
        }

        // Split back to lines preserving newlines correctly
        let lines = sourceStr.split('\n');
        c.source = lines.map((line, idx) => (idx < lines.length - 1) ? line + '\n' : line);
    }
});

fs.writeFileSync('distillation_notebook.ipynb', JSON.stringify(data, null, 1));
console.log('Fixed wiki extraction');
