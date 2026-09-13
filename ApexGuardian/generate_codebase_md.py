import os
import datetime

# Configuration
EXCLUDE_DIRS = {
    'venv', 'node_modules', '.next', '__pycache__', '.git', 
    'dist', 'build', 'datasets', 'weights'
}
EXCLUDE_EXTS = {
    '.pkl', '.csv', '.jpg', '.png', '.svg', '.ico', '.env', '.lock'
}
MAX_FILE_SIZE = 500 * 1024  # 500KB

def generate_tree(startpath):
    tree_str = []
    for root, dirs, files in os.walk(startpath):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        level = root.replace(startpath, '').count(os.sep)
        indent = ' ' * 4 * (level)
        tree_str.append(f"{indent}{os.path.basename(root)}/")
        subindent = ' ' * 4 * (level + 1)
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in EXCLUDE_EXTS:
                continue
            fpath = os.path.join(root, f)
            if os.path.getsize(fpath) > MAX_FILE_SIZE:
                continue
            tree_str.append(f"{subindent}{f}")
    return '\n'.join(tree_str)

def get_language(filename):
    ext = os.path.splitext(filename)[1].lower()
    mapping = {
        '.py': 'python',
        '.js': 'javascript',
        '.jsx': 'jsx',
        '.ts': 'typescript',
        '.tsx': 'tsx',
        '.json': 'json',
        '.html': 'html',
        '.css': 'css',
        '.md': 'markdown',
        '.sh': 'bash'
    }
    return mapping.get(ext, '')

def main():
    root_dir = os.getcwd()
    output_file = 'apex_codebase_audit.md'
    
    target_dirs = ['backend', 'frontend']
    processed_files = 0
    
    with open(output_file, 'w', encoding='utf-8') as out:
        out.write("# Apex Guardian Codebase Audit\n")
        out.write(f"**Generated:** {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        out.write("## Directory Tree\n```text\n")
        for d in target_dirs:
            if os.path.exists(d):
                out.write(generate_tree(d) + '\n')
        out.write("```\n\n")
        
        out.write("## File Contents\n\n")
        
        for d in target_dirs:
            if not os.path.exists(d):
                continue
            for root, dirs, files in os.walk(d):
                dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
                for file in files:
                    ext = os.path.splitext(file)[1].lower()
                    if ext in EXCLUDE_EXTS:
                        continue
                    
                    filepath = os.path.join(root, file)
                    try:
                        if os.path.getsize(filepath) > MAX_FILE_SIZE:
                            continue
                        
                        with open(filepath, 'r', encoding='utf-8') as f:
                            content = f.read()
                            
                        rel_path = os.path.relpath(filepath, root_dir)
                        # Replace backslashes with forward slashes for markdown consistency
                        rel_path_str = rel_path.replace('\\', '/')
                        
                        out.write(f"### {rel_path_str}\n")
                        lang = get_language(file)
                        out.write(f"```{lang}\n{content}\n```\n\n")
                        processed_files += 1
                        
                    except Exception as e:
                        print(f"Skipping {filepath}: {e}")

    final_size = os.path.getsize(output_file)
    print(f"Audit generation complete!")
    print(f"Processed files: {processed_files}")
    print(f"Output file: {output_file}")
    print(f"File size: {final_size / 1024:.2f} KB")

if __name__ == "__main__":
    main()
