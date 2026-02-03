# -*- coding: utf-8 -*-
"""
엑셀 데이터 정제 실행 스크립트
"""
import sys
import os

# 현재 디렉토리의 excel 모듈 import
from excel import process_multiple_files

# 인코딩 설정
sys.stdout.reconfigure(encoding='utf-8')

if __name__ == '__main__':
    # 파일 목록
    files = ['24공통비.XLSX', '25공통비.XLSX']
    
    # 출력 디렉토리
    output_dir = './out'
    
    print("공통부서비용 데이터 정제를 시작합니다...")
    print(f"처리할 파일: {', '.join(files)}\n")
    
    # 처리 실행
    result = process_multiple_files(files, output_dir=output_dir)
    
    print("\n처리가 완료되었습니다!")
    print(f"출력 디렉토리: {output_dir}")

