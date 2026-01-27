from playwright.sync_api import sync_playwright
import time

def test_customer_card_interactions():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 375, 'height': 667}) # Mobile viewport
        
        try:
            page.goto('http://localhost:3001')
            page.wait_for_load_state('networkidle')
            
            # 1. Check if card exists (assuming a client is selected or we can select one)
            # If no client is selected, we need to select one first
            if page.locator('text=Selecionar Cliente').is_visible():
                print("Selecting a client first...")
                page.click('text=Selecionar Cliente')
                page.wait_for_selector('.glass', timeout=5000)
                # Click the first client in the list
                page.locator('.glass').first.click()
                page.wait_for_load_state('networkidle')

            # 2. Verify Compact Layout Elements
            # Check for IA icon
            ia_button = page.locator('button[aria-label="IA"]')
            print(f"IA button visible: {ia_button.is_visible()}")
            
            # Check for Trocar icon
            trocar_button = page.locator('button[aria-label="Trocar"]')
            print(f"Trocar button visible: {trocar_button.is_visible()}")
            
            # 3. Test Clicking Card Body (opens menu)
            print("Clicking card body...")
            # Click the name area
            page.locator('h2.text-base').click()
            page.wait_for_selector('text=Ações do Cliente', timeout=5000)
            print("Bottom sheet 'Ações do Cliente' opened successfully.")
            
            # Close menu
            page.click('text=Cancelar')
            time.sleep(0.5)

            # 4. Test IA Button
            print("Clicking IA button...")
            ia_button.click()
            # We expect a modal or action to trigger. 
            # Since we don't know the exact modal ID, we just check if it didn't crash
            print("IA button clicked.")

            # 5. Test Trocar Button
            print("Clicking Trocar button...")
            trocar_button.click()
            # Should open client selection
            page.wait_for_selector('text=Selecionar Cliente', timeout=5000)
            print("Client selection opened successfully.")

            # 6. Check Desktop Layout (width 1024)
            print("Checking desktop layout...")
            page.set_viewport_size({'width': 1024, 'height': 768})
            page.wait_for_load_state('networkidle')
            # Desktop layout should still have the "Trocar de cliente" text or similar
            desktop_card = page.locator('div.hidden.sm\\:flex')
            print(f"Desktop card visible: {desktop_card.is_visible()}")

        except Exception as e:
            print(f"Test failed: {e}")
            page.screenshot(path='test_failure.png')
        finally:
            browser.close()

if __name__ == "__main__":
    test_customer_card_interactions()
