#!/usr/bin/env python3

import os
import sys
import re
import chardet
import pysubs2
import click
from pathlib import Path
from typing import List, Tuple, Optional, Dict
from langdetect import detect, LangDetectException
from fuzzywuzzy import fuzz
from colorama import init, Fore, Style
import subprocess
import tempfile
import shutil
import json
try:
    from opencc import OpenCC
    OPENCC_AVAILABLE = True
except ImportError:
    OPENCC_AVAILABLE = False

init(autoreset=True)

class SubtitleProcessor:
    def __init__(self):
        self.chinese_patterns = re.compile(r'[\u4e00-\u9fff\u3400-\u4dbf]+')
        self.english_patterns = re.compile(r'[a-zA-Z]+')
        self.video_extensions = {'.mkv', '.mp4', '.avi', '.mov', '.webm'}
        
        # Pattern to extract season and episode numbers
        self.episode_patterns = [
            re.compile(r'[Ss](\d+)[Ee](\d+)', re.IGNORECASE),  # S01E01
            re.compile(r'(\d+)[xX](\d+)'),  # 1x01
            re.compile(r'[Ss]eason\s*(\d+)\s*[Ee]pisode\s*(\d+)', re.IGNORECASE),  # Season 1 Episode 1
            re.compile(r'第(\d+)季.*第(\d+)[集话話]'),  # Chinese: 第1季第1集
        ]
        
        # Initialize OpenCC converter if available
        if OPENCC_AVAILABLE:
            self.s2t_converter = OpenCC('s2t')  # Simplified to Traditional
        else:
            self.s2t_converter = None
        
    def is_traditional_chinese(self, text: str) -> bool:
        """Detect if Chinese text is Traditional (vs Simplified)"""
        # Common Traditional Chinese characters that don't exist in Simplified
        traditional_chars = set('繁體中國語言學習書寫讀說聽講義務電腦網絡軟體硬碟記憶體處理器圖畫機器學習訓練測試數據庫連線斷開啟動關閉檔案夾複製貼上剪切選擇確認取消設定選項幫助說明關於版權')
        # Common Simplified Chinese characters that don't exist in Traditional
        simplified_chars = set('简体中国语言学习书写读说听讲义务电脑网络软体硬盘记忆体处理器图画机器学习训练测试数据库连线断开启动关闭档案夹复制贴上剪切选择确认取消设定选项帮助说明关于版权')
        
        trad_count = sum(1 for char in text if char in traditional_chars)
        simp_count = sum(1 for char in text if char in simplified_chars)
        
        return trad_count > simp_count
    
    def convert_to_traditional(self, text: str) -> str:
        """Convert Simplified Chinese to Traditional Chinese"""
        if self.s2t_converter and not self.is_traditional_chinese(text):
            return self.s2t_converter.convert(text)
        return text
    
    def extract_episode_info(self, filename: str) -> Optional[Tuple[int, int]]:
        """Extract season and episode numbers from filename"""
        for pattern in self.episode_patterns:
            match = pattern.search(filename)
            if match:
                season = int(match.group(1))
                episode = int(match.group(2))
                return (season, episode)
        
        # Try to find just episode number if no season
        episode_only = re.search(r'[Ee]p?(\d+)', filename)
        if episode_only:
            return (1, int(episode_only.group(1)))
        
        # Check for just a number that might be episode
        number_match = re.search(r'(\d+)', filename)
        if number_match:
            num = int(number_match.group(1))
            if 1 <= num <= 99:  # Reasonable episode range
                return (1, num)
        
        return None
    
    def detect_encoding(self, file_path: Path) -> str:
        """Detect file encoding"""
        with open(file_path, 'rb') as f:
            raw_data = f.read()
            result = chardet.detect(raw_data)
            return result['encoding'] or 'utf-8'
    
    def extract_subtitles_from_video(self, video_path: Path, output_dir: Path) -> List[Path]:
        """Extract subtitle tracks from video files"""
        extracted_subs = []
        
        try:
            print(f"{Fore.CYAN}Checking video file: {video_path.name}")
            
            # Get subtitle track info using ffprobe
            cmd = [
                'ffprobe', '-v', 'quiet', '-print_format', 'json',
                '-show_streams', '-select_streams', 's', str(video_path)
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                return extracted_subs
            
            streams_data = json.loads(result.stdout)
            subtitle_streams = streams_data.get('streams', [])
            
            if not subtitle_streams:
                print(f"  {Fore.YELLOW}No subtitle tracks found in {video_path.name}")
                return extracted_subs
            
            print(f"  {Fore.GREEN}Found {len(subtitle_streams)} subtitle track(s)")
            
            # Extract each subtitle track
            for i, stream in enumerate(subtitle_streams):
                stream_index = stream.get('index', i)
                codec_name = stream.get('codec_name', 'unknown')
                
                # Get language info
                tags = stream.get('tags', {})
                language = tags.get('language', 'unknown')
                title = tags.get('title', '')
                
                # Generate output filename
                base_name = video_path.stem
                output_name = f"{base_name}.{language}"
                if title:
                    output_name += f".{title.replace(' ', '_')}"
                output_name += f".track{stream_index}.srt"
                output_path = output_dir / output_name
                
                # Extract subtitle
                extract_cmd = [
                    'ffmpeg', '-i', str(video_path),
                    '-map', f'0:s:{i}',
                    '-c:s', 'srt',
                    str(output_path),
                    '-y'  # Overwrite if exists
                ]
                
                result = subprocess.run(extract_cmd, capture_output=True, text=True)
                if result.returncode == 0:
                    print(f"  {Fore.GREEN}Extracted: {output_name} (language: {language})")
                    extracted_subs.append(output_path)
                else:
                    print(f"  {Fore.RED}Failed to extract track {stream_index}")
            
        except Exception as e:
            print(f"{Fore.RED}Error extracting subtitles from {video_path.name}: {e}")
        
        return extracted_subs
    
    def detect_language(self, file_path: Path) -> str:
        """Detect subtitle language based on content"""
        try:
            encoding = self.detect_encoding(file_path)
            subs = pysubs2.load(str(file_path), encoding=encoding)
            
            sample_text = ""
            total_lines = len(subs)
            is_ass_file = file_path.suffix.lower() in ['.ass', '.ssa']
            
            # Sample from multiple parts of the file for better detection
            sample_ranges = [
                (0, min(10, total_lines)),  # Beginning
                (max(0, total_lines // 3), min(total_lines // 3 + 10, total_lines)),  # Middle
                (max(0, total_lines - 10), total_lines)  # End
            ]
            
            for start, end in sample_ranges:
                for i in range(start, end):
                    if i < total_lines:
                        text = subs[i].text
                        # Strip ASS markup for better language detection
                        if is_ass_file:
                            # Remove ASS styling tags like {\pos(960,85)}
                            text = re.sub(r'\{[^}]*\}', '', text)
                        sample_text += text + " "
            
            chinese_count = len(self.chinese_patterns.findall(sample_text))
            english_count = len(self.english_patterns.findall(sample_text))
            
            # If we have significant Chinese characters, prefer Chinese
            if chinese_count >= 10 and chinese_count >= english_count * 0.7:
                return 'zh'
            elif is_ass_file and chinese_count >= 5:
                # For ASS files, be more aggressive about Chinese detection
                return 'zh'
            elif english_count > chinese_count and chinese_count < 5:
                return 'en'
            else:
                # Fallback to langdetect
                try:
                    lang = detect(sample_text)
                    detected_lang = 'zh' if lang in ['zh-cn', 'zh-tw'] else lang
                    if detected_lang in ['zh', 'zh-cn', 'zh-tw']:
                        return 'zh'
                    elif detected_lang == 'ja' and is_ass_file and chinese_count > 0:
                        # Japanese detection in ASS files with Chinese chars - likely Chinese
                        return 'zh'
                    else:
                        return detected_lang
                except:
                    # If we have any Chinese characters, assume Chinese
                    if chinese_count > 0:
                        return 'zh'
                    return 'unknown'
                    
        except Exception as e:
            print(f"{Fore.YELLOW}Warning: Could not detect language for {file_path}: {e}")
            return 'unknown'
    
    def find_subtitle_pairs(self, folder_path: Path, extract_from_video: bool = True) -> List[Tuple[Path, Path]]:
        """Find matching English-Chinese subtitle pairs"""
        # More robust subtitle file detection (SRT and ASS)
        subtitle_files = []
        
        # Supported subtitle extensions
        subtitle_extensions = {'.srt', '.ass', '.ssa'}
        
        # Method 1: Standard glob for each extension
        for ext in subtitle_extensions:
            subtitle_files.extend(folder_path.glob(f"*{ext}"))
        
        # Method 2: Case-insensitive check using os.listdir
        try:
            for item in os.listdir(folder_path):
                item_lower = item.lower()
                if any(item_lower.endswith(ext) for ext in subtitle_extensions):
                    item_path = folder_path / item
                    if item_path.is_file() and item_path not in subtitle_files:
                        subtitle_files.append(item_path)
        except Exception as e:
            print(f"{Fore.YELLOW}Warning: Error scanning directory with os.listdir: {e}")
        
        # Remove duplicates while preserving order
        seen = set()
        unique_files = []
        for f in subtitle_files:
            if f not in seen:
                seen.add(f)
                unique_files.append(f)
        subtitle_files = unique_files
        
        # Check for existing extracted subtitles even if not extracting
        temp_dir = folder_path / '.extracted_subs'
        if temp_dir.exists():
            existing_extracted = []
            for ext in subtitle_extensions:
                existing_extracted.extend(temp_dir.glob(f"*{ext}"))
            if existing_extracted and not extract_from_video:
                print(f"{Fore.CYAN}Found {len(existing_extracted)} previously extracted subtitle(s). Including them...")
                subtitle_files.extend(existing_extracted)
        
        # Extract subtitles from video files if requested
        if extract_from_video:
            video_files = []
            for ext in self.video_extensions:
                video_files.extend(folder_path.glob(f"*{ext}"))
            
            if video_files:
                print(f"{Fore.CYAN}Found {len(video_files)} video file(s). Extracting subtitles...")
                temp_dir = folder_path / '.extracted_subs'
                temp_dir.mkdir(exist_ok=True)
                
                for video_file in video_files:
                    extracted = self.extract_subtitles_from_video(video_file, temp_dir)
                    subtitle_files.extend(extracted)
                
                print()
        
        english_files = []
        chinese_files = []
        
        print(f"{Fore.CYAN}Analyzing {len(subtitle_files)} subtitle files...")
        
        # Debug: Show all found files
        if len(subtitle_files) == 0:
            print(f"{Fore.YELLOW}No subtitle files found in {folder_path}")
            print(f"{Fore.YELLOW}Make sure:")
            print(f"{Fore.YELLOW}  1. The subtitle files are in the correct folder: {folder_path.absolute()}")
            print(f"{Fore.YELLOW}  2. The files have .srt or .ass extension")
            print(f"{Fore.YELLOW}  3. You have read permissions for the files")
        
        for subtitle_file in subtitle_files:
            lang = self.detect_language(subtitle_file)
            if lang == 'en':
                english_files.append(subtitle_file)
                print(f"  {Fore.GREEN}English: {subtitle_file.name}")
            elif lang == 'zh':
                chinese_files.append(subtitle_file)
                print(f"  {Fore.BLUE}Chinese: {subtitle_file.name}")
            else:
                print(f"  {Fore.YELLOW}Unknown: {subtitle_file.name}")
        
        pairs = []
        used_chinese = set()
        
        print(f"\n{Fore.CYAN}Matching subtitle pairs...")
        
        # Filter out dual subtitle files to avoid matching them again
        # Also prefer Full subtitles over Forced subtitles
        clean_english_files = [f for f in english_files if '_dual' not in f.name]
        
        # Group files by episode and prefer Full over Forced
        episode_files = {}
        for f in clean_english_files:
            episode = self.extract_episode_info(f.name)
            if episode:
                if episode not in episode_files:
                    episode_files[episode] = []
                episode_files[episode].append(f)
        
        # For each episode, prefer Full subtitles over Forced
        preferred_english_files = []
        for episode, files in episode_files.items():
            if len(files) == 1:
                preferred_english_files.append(files[0])
            else:
                # Prefer files with "Full" in the name, or without "Forced"
                full_files = [f for f in files if 'Full' in f.name or 'Forced' not in f.name]
                if full_files:
                    preferred_english_files.append(full_files[0])
                else:
                    preferred_english_files.append(files[0])
        
        # Add any files without episode info
        for f in clean_english_files:
            if not self.extract_episode_info(f.name):
                preferred_english_files.append(f)
        
        clean_english_files = preferred_english_files
        
        # First pass: exact season+episode matches only
        for eng_file in clean_english_files:
            if eng_file in [pair[0] for pair in pairs]:  # Skip if already matched
                continue
                
            best_match = None
            best_score = 0
            match_method = ""
            
            eng_episode = self.extract_episode_info(eng_file.name)
            
            if eng_episode:
                # Look for exact season+episode match only
                for chi_file in chinese_files:
                    if chi_file in used_chinese:
                        continue
                    
                    chi_episode = self.extract_episode_info(chi_file.name)
                    # Only exact season+episode match
                    if chi_episode and chi_episode == eng_episode:
                        best_match = chi_file
                        best_score = 100
                        match_method = f"S{eng_episode[0]:02d}E{eng_episode[1]:02d}"
                        break
            
            if best_match:
                pairs.append((eng_file, best_match))
                used_chinese.add(best_match)
                print(f"  {Fore.GREEN}Matched by episode {match_method}: {eng_file.name} <-> {best_match.name}")
        
        # Second pass: episode-only matches for remaining files
        for eng_file in clean_english_files:
            if eng_file in [pair[0] for pair in pairs]:  # Skip if already matched
                continue
                
            best_match = None
            best_score = 0
            match_method = ""
            
            eng_episode = self.extract_episode_info(eng_file.name)
            
            if eng_episode:
                # Episode-only match as fallback
                for chi_file in chinese_files:
                    if chi_file in used_chinese:
                        continue
                    
                    chi_episode = self.extract_episode_info(chi_file.name)
                    # Match if same episode number (ignore season if different)
                    if chi_episode and chi_episode[1] == eng_episode[1]:
                        best_match = chi_file
                        best_score = 100
                        match_method = f"S{eng_episode[0]:02d}E{eng_episode[1]:02d}"
                        break
            
            if best_match:
                pairs.append((eng_file, best_match))
                used_chinese.add(best_match)
                chi_episode = self.extract_episode_info(best_match.name)
                if chi_episode and eng_episode and chi_episode[0] != eng_episode[0]:
                    print(f"  {Fore.GREEN}Matched by episode E{eng_episode[1]:02d}: {eng_file.name} <-> {best_match.name} (season mismatch ignored)")
                else:
                    print(f"  {Fore.GREEN}Matched by episode {match_method}: {eng_file.name} <-> {best_match.name}")
        
        # Third pass: filename similarity for remaining files
        for eng_file in clean_english_files:
            if eng_file in [pair[0] for pair in pairs]:  # Skip if already matched
                continue
                
            best_match = None
            best_score = 0
            match_method = ""
            eng_episode = self.extract_episode_info(eng_file.name)
            
            # Filename similarity fallback
            eng_base = eng_file.stem.lower()
            # Remove common English suffixes
            eng_base = re.sub(r'[._-]?(en|eng|english)$', '', eng_base, flags=re.IGNORECASE)
            
            for chi_file in chinese_files:
                if chi_file in used_chinese:
                    continue
                    
                chi_base = chi_file.stem.lower()
                # Remove common Chinese suffixes
                chi_base = re.sub(r'[._-]?(ch|chi|chinese|chs|cht|zh|zho|tc|sc)$', '', chi_base, flags=re.IGNORECASE)
                
                # Calculate similarity score
                score = fuzz.ratio(eng_base, chi_base)
                
                if score > best_score and score > 60:  # 60% similarity threshold
                    best_score = score
                    best_match = chi_file
                    match_method = "name"
            
            if best_match:
                pairs.append((eng_file, best_match))
                used_chinese.add(best_match)
                print(f"  {Fore.GREEN}Matched by {match_method}: {eng_file.name} <-> {best_match.name} (score: {best_score}%)")
            else:
                episode_str = f" (Episode {eng_episode})" if eng_episode else ""
                print(f"  {Fore.YELLOW}No match found for: {eng_file.name}{episode_str}")
        
        return pairs
    
    def sync_subtitles(self, reference_file: Path, unsync_file: Path, output_file: Path) -> bool:
        """Sync Chinese subtitles to English reference using ffsubsync"""
        try:
            print(f"{Fore.CYAN}Synchronizing {unsync_file.name} to {reference_file.name}...")
            
            # Check if ffsubsync is available
            result = subprocess.run(['ffsubsync', '--version'], capture_output=True, text=True)
            if result.returncode != 0:
                print(f"{Fore.RED}Error: ffsubsync not found. Please install it with: pip install ffsubsync")
                return False
            
            # Run ffsubsync
            cmd = [
                'ffsubsync',
                str(reference_file),
                '-i', str(unsync_file),
                '-o', str(output_file)
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                print(f"{Fore.GREEN}Successfully synchronized!")
                return True
            else:
                print(f"{Fore.RED}Synchronization failed: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"{Fore.RED}Error during synchronization: {e}")
            return False
    
    def merge_subtitles(self, eng_file: Path, chi_file: Path, output_file: Path, sync_chinese: bool = True, convert_chinese: bool = True, position: str = 'bottom'):
        """Merge English and Chinese subtitles into dual subtitle format"""
        try:
            # Load English subtitles
            eng_encoding = self.detect_encoding(eng_file)
            eng_subs = pysubs2.load(str(eng_file), encoding=eng_encoding)
            
            # Sync Chinese subtitles if requested
            if sync_chinese:
                with tempfile.NamedTemporaryFile(suffix='.srt', delete=False) as tmp_file:
                    tmp_path = Path(tmp_file.name)
                    
                if self.sync_subtitles(eng_file, chi_file, tmp_path):
                    chi_file = tmp_path
                else:
                    print(f"{Fore.YELLOW}Warning: Synchronization failed, using original Chinese timing")
            
            # Load Chinese subtitles
            chi_encoding = self.detect_encoding(chi_file)
            chi_subs = pysubs2.load(str(chi_file), encoding=chi_encoding)
            
            # Create merged subtitles
            merged_subs = pysubs2.SSAFile()
            
            # Process each English subtitle
            for eng_event in eng_subs:
                # Find overlapping Chinese subtitles
                chi_texts = []
                for chi_event in chi_subs:
                    # Check if Chinese subtitle overlaps with English
                    if chi_event.start <= eng_event.end and chi_event.end >= eng_event.start:
                        chi_texts.append(chi_event.text)
                
                # Create dual subtitle
                if chi_texts:
                    # Combine all overlapping Chinese subtitles
                    chi_text = ' '.join(chi_texts)
                    
                    # Convert to Traditional Chinese if enabled
                    if convert_chinese and self.s2t_converter:
                        chi_text = self.convert_to_traditional(chi_text)
                    
                    # Create dual subtitle with positioning
                    if position == 'bottom':
                        dual_text = f"{eng_event.text}\\N{chi_text}"
                    else:  # top
                        dual_text = f"{chi_text}\\N{eng_event.text}"
                else:
                    # No matching Chinese subtitle
                    dual_text = f"{eng_event.text}\\N[No Chinese subtitle]"
                
                # Add to merged subtitles
                merged_event = pysubs2.SSAEvent(
                    start=eng_event.start,
                    end=eng_event.end,
                    text=dual_text
                )
                merged_subs.append(merged_event)
            
            # Save merged subtitles
            merged_subs.save(str(output_file), encoding='utf-8')
            print(f"{Fore.GREEN}Created dual subtitle: {output_file.name}")
            
            # Cleanup temporary file
            if sync_chinese and 'tmp_path' in locals():
                try:
                    tmp_path.unlink()
                except:
                    pass
                    
        except Exception as e:
            print(f"{Fore.RED}Error merging subtitles: {e}")
            raise

@click.command()
@click.argument('folder_path', type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option('--output-dir', '-o', help='Output directory for dual subtitles (default: same as input)')
@click.option('--no-sync', is_flag=True, help='Disable automatic synchronization of Chinese subtitles')
@click.option('--suffix', default='_dual', help='Suffix for output files (default: _dual)')
@click.option('--no-extract', is_flag=True, help='Disable extraction of subtitles from video files')
@click.option('--no-convert', is_flag=True, help='Disable conversion to Traditional Chinese')
@click.option('--position', default='bottom', type=click.Choice(['top', 'bottom']), help='Position subtitles at top or bottom (default: bottom)')
def main(folder_path, output_dir, no_sync, suffix, no_extract, no_convert, position):
    """
    Create dual subtitles by combining English and Chinese SRT files.
    
    FOLDER_PATH: Path to folder containing subtitle files
    """
    folder = Path(folder_path)
    output_folder = Path(output_dir) if output_dir else folder
    
    if output_dir and not output_folder.exists():
        output_folder.mkdir(parents=True)
    
    print(f"{Fore.CYAN}{'='*60}")
    print(f"{Fore.CYAN}Dual Subtitle Creator")
    print(f"{Fore.CYAN}{'='*60}")
    print(f"Input folder: {folder}")
    print(f"Output folder: {output_folder}")
    print(f"Synchronization: {'Disabled' if no_sync else 'Enabled'}")
    print(f"Video extraction: {'Disabled' if no_extract else 'Enabled'}")
    print(f"Chinese conversion: {'Disabled' if no_convert else 'Simplified → Traditional'}")
    
    if not no_convert and not OPENCC_AVAILABLE:
        print(f"{Fore.YELLOW}Warning: OpenCC not available. Install with: pip install opencc-python-reimplemented")
        print(f"{Fore.YELLOW}Continuing without Chinese conversion...")
    
    print()
    
    processor = SubtitleProcessor()
    
    # Find subtitle pairs
    pairs = processor.find_subtitle_pairs(folder, extract_from_video=not no_extract)
    
    if not pairs:
        print(f"{Fore.YELLOW}No matching subtitle pairs found!")
        return
    
    print(f"\n{Fore.CYAN}Processing {len(pairs)} subtitle pairs...")
    print(f"{Fore.CYAN}{'='*60}")
    
    success_count = 0
    
    for eng_file, chi_file in pairs:
        print(f"\n{Fore.CYAN}Processing: {eng_file.name} + {chi_file.name}")
        
        # Generate output filename
        output_name = f"{eng_file.stem}{suffix}.srt"
        output_path = output_folder / output_name
        
        try:
            processor.merge_subtitles(eng_file, chi_file, output_path, sync_chinese=not no_sync, convert_chinese=not no_convert, position=position)
            success_count += 1
        except Exception as e:
            print(f"{Fore.RED}Failed to process pair: {e}")
    
    print(f"\n{Fore.CYAN}{'='*60}")
    print(f"{Fore.GREEN}Successfully created {success_count}/{len(pairs)} dual subtitle files!")
    
    # Cleanup extracted subtitles if any
    temp_dir = folder / '.extracted_subs'
    if temp_dir.exists() and not no_extract:
        print(f"\n{Fore.CYAN}Cleaning up extracted subtitles...")
        try:
            shutil.rmtree(temp_dir)
            print(f"{Fore.GREEN}Cleanup complete.")
        except Exception as e:
            print(f"{Fore.YELLOW}Warning: Could not clean up {temp_dir}: {e}")

if __name__ == "__main__":
    main()