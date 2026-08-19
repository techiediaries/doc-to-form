
import requests
from bs4 import BeautifulSoup
import json
import re
import os
import unicodedata
from collections import deque
from urllib.parse import urljoin, urlparse

# Base URL for the website
BASE_URL = "https://bulletinofficiel.com/"
MAX_PAGES_TO_CRAWL = 100 # Limit the number of pages for analysis

def slugify(value):
    """
    Normalizes string, converts to lowercase, replaces spaces with hyphens,
    and removes non-word characters except hyphens.
    """
    value = value.strip()
    value = re.sub(r'\s+', '-', value) # Replace spaces with hyphens
    value = re.sub(r'[^\w-]', '', value) # Remove non-word chars except hyphens
    value = value.lower() # Convert to lowercase
    return value

def scrape_page_for_analysis(url, output_dir):
    """
    Scrapes a single page, extracts its title and main text content,
    and saves it to a text file.
    """
    try:
        response = requests.get(url)
        response.raise_for_status()
    except requests.RequestException as e:
        print(f"Error fetching {url}: {e}")
        return None

    soup = BeautifulSoup(response.content, 'html.parser')

    title_tag = soup.find('h1', class_='entry-title') or soup.find('title')
    title = title_tag.get_text(strip=True) if title_tag else "No Title"
    
    # Try to get the main content area
    main_content_div = soup.find('div', class_='entry') or soup.find('div', class_='post-inner') or soup.find('main')

    if not main_content_div:
        print(f"Warning: No main content found for {url}")
        content_text = soup.get_text(separator='\n', strip=True) # Fallback to full text
    else:
        content_text = main_content_div.get_text(separator='\n', strip=True)

    # Clean up extra whitespace
    content_text = re.sub(r'\n\s*\n', '\n\n', content_text)
    
    file_name = slugify(title) + '.txt'
    if not file_name: # Fallback if title slugification fails
        file_name = slugify(urlparse(url).path.replace('/', '-')) + '.txt'
        if not file_name:
            file_name = f"page_{len(os.listdir(output_dir)) + 1}.txt"

    output_path = os.path.join(output_dir, file_name)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(f"URL: {url}\n")
        f.write(f"Title: {title}\n\n")
        f.write(content_text)
        
    print(f"  ✓ Saved content from {url} to {output_path}")
    return output_path

def get_all_links_for_analysis(soup, base_url, visited_urls):
    """
    Extracts all relevant links from a BeautifulSoup object for analysis.
    Less restrictive than template scraping.
    """
    links = set()
    for a_tag in soup.find_all('a', href=True):
        href = a_tag['href']
        full_url = urljoin(base_url, href)
        
        # Filter for relevant links within the domain
        if BASE_URL in full_url and \
           '#' not in full_url and \
           '?' not in full_url and \
           not full_url.endswith(('.pdf', '.doc', '.docx', '.zip', '.rar')) and \
           full_url != base_url and \
           full_url not in visited_urls:
            links.add(full_url)
    return list(links)

def main():
    initial_url = BASE_URL # Start from the homepage for broader analysis
    output_dir = 'scraped_analysis_content'
    os.makedirs(output_dir, exist_ok=True)

    queue = deque([initial_url])
    visited_urls = set()
    crawled_pages_count = 0

    print(f"Starting comprehensive scraping from: {initial_url}")

    while queue and crawled_pages_count < MAX_PAGES_TO_CRAWL:
        current_url = queue.popleft()

        if current_url in visited_urls:
            continue

        visited_urls.add(current_url)
        print(f"Processing: {current_url} ({crawled_pages_count}/{MAX_PAGES_TO_CRAWL} pages crawled)")

        saved_path = scrape_page_for_analysis(current_url, output_dir)
        if saved_path:
            crawled_pages_count += 1
        
        # Fetch the page again to get soup for link extraction if it wasn't successful before
        # Or if we just saved the text content without returning soup
        try:
            response = requests.get(current_url)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')
            new_links = get_all_links_for_analysis(soup, current_url, visited_urls)
            for link in new_links:
                if link not in visited_urls and link not in queue:
                    queue.append(link)
        except requests.RequestException as e:
            print(f"Error fetching {current_url} for link extraction: {e}")


    print(f"\nFinished comprehensive scraping. Crawled {crawled_pages_count} pages.")
    print(f"Content saved to '{output_dir}' for analysis.")

if __name__ == '__main__':
    main()
